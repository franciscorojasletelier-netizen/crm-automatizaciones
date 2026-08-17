import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/whatsapp'

// Ejecuta los pasos pendientes de las secuencias de follow-up (Fase 8.1).
// La inscripción y la detención por cambio de estado del deal ya las
// resuelve un trigger en la base (migración 029) — este cron solo
// procesa lo que ya está "en cola" (`next_run_at <= now()`).
const BATCH_LIMIT = 200
const CONCURRENCY = 8

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: enrollments, error: enrollErr } = await supabase
      .from('automation_sequence_enrollments')
      .select('id, organization_id, sequence_id, deal_id, current_step')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 })
    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 })
    }

    let processed = 0
    let completed = 0
    const errors: string[] = []

    await mapWithConcurrency(enrollments, CONCURRENCY, async (enrollment) => {
      try {
        const nextStepOrder = enrollment.current_step + 1

        const { data: step } = await supabase
          .from('automation_sequence_steps')
          .select('*')
          .eq('sequence_id', enrollment.sequence_id)
          .eq('step_order', nextStepOrder)
          .maybeSingle()

        if (!step) {
          // No hay más pasos — la secuencia terminó para este deal.
          await supabase.from('automation_sequence_enrollments')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', enrollment.id)
          completed++
          return
        }

        const { data: deal } = await supabase
          .from('deals')
          .select('id, owner_id, next_action, contacts:primary_contact_id(full_name, phone)')
          .eq('id', enrollment.deal_id).is('deleted_at', null).maybeSingle()

        if (!deal) {
          await supabase.from('automation_sequence_enrollments')
            .update({ status: 'stopped', stopped_reason: 'deal_not_found', updated_at: new Date().toISOString() })
            .eq('id', enrollment.id)
          return
        }

        let stepOk = true
        let stepDetail = ''

        if (step.action_type === 'send_whatsapp_template') {
          const phone = (deal.contacts as any)?.phone
          const templateId = step.action_config?.template_id
          if (!phone) { stepOk = false; stepDetail = 'Contacto sin teléfono' }
          else if (!templateId) { stepOk = false; stepDetail = 'Paso sin plantilla configurada' }
          else {
            const { data: template } = await supabase
              .from('whatsapp_templates').select('content').eq('id', templateId).maybeSingle()
            if (!template) { stepOk = false; stepDetail = 'Plantilla no encontrada' }
            else {
              const firstName = ((deal.contacts as any)?.full_name ?? '').split(' ')[0] ?? ''
              const body = template.content.replace(/\{\{\s*nombre\s*\}\}/gi, firstName)
              const result = await sendWhatsAppText(supabase, {
                organizationId: enrollment.organization_id, dealId: enrollment.deal_id,
                phone, body, sentBy: null,
              })
              stepOk = result.ok
              stepDetail = result.error ?? ''
            }
          }
        } else if (step.action_type === 'create_task') {
          const cfg = step.action_config ?? {}
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (cfg.days_after ?? 0))
          const { error } = await supabase.from('tasks').insert({
            title: cfg.title ?? 'Tarea de seguimiento', deal_id: enrollment.deal_id,
            assigned_to: deal.owner_id, due_date: dueDate.toISOString(), is_completed: false,
          })
          stepOk = !error
          stepDetail = error?.message ?? ''
        } else if (step.action_type === 'notify_owner' || step.action_type === 'notify_team') {
          const cfg = step.action_config ?? {}
          let targetIds: string[] = []
          if (step.action_type === 'notify_owner') {
            targetIds = deal.owner_id ? [deal.owner_id] : []
          } else {
            const { data: members } = await supabase.from('deal_members').select('user_id').eq('deal_id', enrollment.deal_id)
            targetIds = [...(members ?? []).map((m: any) => m.user_id), ...(deal.owner_id ? [deal.owner_id] : [])]
              .filter((id, i, a) => a.indexOf(id) === i)
          }
          if (targetIds.length > 0) {
            const { error } = await supabase.from('notifications').insert(
              targetIds.map(uid => ({
                user_id: uid, type: 'automation', title: cfg.title ?? 'Secuencia de seguimiento',
                body: cfg.message ?? 'Automatización de secuencia ejecutada',
                entity_type: 'deal', entity_id: enrollment.deal_id,
              }))
            )
            stepOk = !error
            stepDetail = error?.message ?? ''
          }
        }

        await supabase.from('automation_logs').insert({
          organization_id: enrollment.organization_id, rule_id: null,
          rule_name: `Secuencia — paso ${nextStepOrder}`, entity_type: 'deal', entity_id: enrollment.deal_id,
          status: stepOk ? 'success' : 'failed', details: { step_id: step.id, action_type: step.action_type, detail: stepDetail },
        })

        const { data: followingStep } = await supabase
          .from('automation_sequence_steps')
          .select('delay_hours')
          .eq('sequence_id', enrollment.sequence_id)
          .eq('step_order', nextStepOrder + 1)
          .maybeSingle()

        if (followingStep) {
          const nextRun = new Date(Date.now() + followingStep.delay_hours * 60 * 60 * 1000)
          await supabase.from('automation_sequence_enrollments').update({
            current_step: nextStepOrder, next_run_at: nextRun.toISOString(), updated_at: new Date().toISOString(),
          }).eq('id', enrollment.id)
        } else {
          await supabase.from('automation_sequence_enrollments').update({
            current_step: nextStepOrder, status: 'completed', updated_at: new Date().toISOString(),
          }).eq('id', enrollment.id)
          completed++
        }

        processed++
      } catch (e: any) {
        errors.push(`enrollment ${enrollment.id}: ${e.message}`)
      }
    })

    return NextResponse.json({ ok: true, processed, completed, errors: errors.length ? errors : undefined })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
