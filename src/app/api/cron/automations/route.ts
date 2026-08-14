import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executeAutomationAction } from '@/lib/automations'

// Techo por regla: con orgs grandes, "deals abiertos sin cambios hace
// N días" puede ser miles de filas — no tiene sentido procesarlas todas
// en una sola corrida del cron, mañana vuelve a correr para el resto.
const DEALS_PER_RULE_LIMIT = 200
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

// Único disparador de automatizaciones que no ocurre por una acción de
// usuario: "días sin actividad". Antes de este cron, un cliente podía
// crear y "activar" esta regla en /automatizaciones y nunca se ejecutaba
// — quedaba como configuración muerta, indistinguible en la UI de las
// reglas que sí funcionan (stage_change/deal_won/deal_lost, disparadas
// desde el kanban).
export async function GET(request: NextRequest) {
  // Falla cerrado: si CRON_SECRET no está seteada, el endpoint queda
  // público en vez de protegido — antes el chequeo se saltaba entero.
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

  // service_role bypasea RLS — cada query filtra organization_id a mano,
  // igual que los otros crons (webhooks, task-reminders).
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: orgs, error: orgsErr } = await supabase
      .from('organizations').select('id').eq('is_active', true)
    if (orgsErr) return NextResponse.json({ error: orgsErr.message }, { status: 500 })

    let rulesEvaluated = 0
    let dealsTriggered = 0
    const errors: string[] = []

    for (const org of orgs ?? []) {
      const { data: rules } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .eq('trigger_type', 'days_inactive')

      for (const rule of rules ?? []) {
        rulesEvaluated++
        const days = Number(rule.trigger_config?.days) || 7
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        const { data: deals, error: dealsErr } = await supabase
          .from('deals')
          .select('id, owner_id, updated_at')
          .eq('organization_id', org.id)
          .eq('status', 'open')
          .is('deleted_at', null)
          .lte('updated_at', threshold)
          .order('updated_at', { ascending: true })
          .limit(DEALS_PER_RULE_LIMIT)

        if (dealsErr) { errors.push(`org ${org.id} rule ${rule.id}: ${dealsErr.message}`); continue }
        if (!deals || deals.length === 0) continue

        // Ya se avisó de este deal para esta regla desde su último cambio
        // (updated_at) → no se repite hasta que el deal se mueva de nuevo.
        const { data: logs } = await supabase
          .from('automation_logs')
          .select('entity_id, executed_at')
          .eq('rule_id', rule.id)
          .in('entity_id', deals.map(d => d.id))

        const lastRun = new Map<string, string>()
        for (const log of logs ?? []) {
          const prev = lastRun.get(log.entity_id)
          if (!prev || log.executed_at > prev) lastRun.set(log.entity_id, log.executed_at)
        }

        const pending = deals.filter(deal => {
          const last = lastRun.get(deal.id)
          return !(last && last >= deal.updated_at) // ya avisado desde el último cambio
        })

        await mapWithConcurrency(pending, CONCURRENCY, async (deal) => {
          await executeAutomationAction(supabase, rule, {
            dealId: deal.id, ownerId: deal.owner_id ?? undefined,
          })
          dealsTriggered++
        })
      }
    }

    return NextResponse.json({ ok: true, rulesEvaluated, dealsTriggered, errors: errors.length ? errors : undefined })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
