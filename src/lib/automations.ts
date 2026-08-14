/**
 * Motor de automatizaciones — ejecuta reglas.
 * Los triggers 'stage_change'/'deal_won'/'deal_lost' corren client-side
 * después de cada cambio de etapa. 'days_inactive' corre desde un cron
 * (ver src/app/api/cron/automations/route.ts) porque no hay ningún
 * evento de usuario que lo dispare — nadie "hace" que un deal quede quieto.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface AutomationContext {
  supabase: SupabaseClient
  dealId: string
  toStage?: string
  status?: 'won' | 'lost' | 'open'
  ownerId?: string
  userId: string
}

// Ejecuta la acción de una regla ya disparada (create_task / notify_owner /
// notify_team), registra el log y actualiza el contador. Compartido entre
// el disparador client-side (cambios de etapa) y el cron (days_inactive).
export async function executeAutomationAction(
  supabase: SupabaseClient,
  rule: any,
  { dealId, ownerId, userId }: { dealId: string; ownerId?: string; userId?: string }
) {
  let logDetails: Record<string, any> = {}
  let logStatus = 'success'

  try {
    if (rule.action_type === 'create_task') {
      const cfg = rule.action_config
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (cfg.days_after ?? 1))

      const { data: newTask, error } = await supabase.from('tasks').insert({
        title:        cfg.title ?? 'Tarea de seguimiento',
        deal_id:      dealId,
        assigned_to:  ownerId ?? userId,
        due_date:     dueDate.toISOString(),
        is_completed: false,
      }).select('id').single()
      if (error) throw error

      const assignedTo = ownerId ?? userId
      if (newTask && assignedTo && assignedTo !== userId) {
        const dueDateStr = dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
        await supabase.from('notifications').insert({
          user_id:     assignedTo,
          type:        'task_due',
          title:       `📋 Nueva tarea asignada: ${cfg.title ?? 'Tarea de seguimiento'}`,
          body:        `Vence el ${dueDateStr} · Creada por automatización "${rule.name}"`,
          entity_type: 'task',
          entity_id:   newTask.id,
        })
      }
      logDetails = { task_title: cfg.title, days_after: cfg.days_after }

    } else if (rule.action_type === 'notify_owner' && ownerId) {
      const cfg = rule.action_config
      const { error } = await supabase.from('notifications').insert({
        user_id:     ownerId,
        type:        'automation',
        title:       rule.name,
        body:        cfg.message ?? 'Automatización ejecutada',
        entity_type: 'deal',
        entity_id:   dealId,
      })
      if (error) throw error
      logDetails = { notified_user: ownerId }

    } else if (rule.action_type === 'notify_team') {
      const cfg = rule.action_config
      const { data: members } = await supabase
        .from('deal_members')
        .select('user_id')
        .eq('deal_id', dealId)

      const targetIds = [
        ...(members ?? []).map((m: any) => m.user_id),
        ...(ownerId ? [ownerId] : []),
      ].filter((id, i, a) => a.indexOf(id) === i)

      if (targetIds.length > 0) {
        const notifs = targetIds.map(uid => ({
          user_id:     uid,
          type:        'automation',
          title:       rule.name,
          body:        cfg.message ?? 'Automatización ejecutada',
          entity_type: 'deal',
          entity_id:   dealId,
        }))
        const { error } = await supabase.from('notifications').insert(notifs)
        if (error) throw error
      }
      logDetails = { notified_count: targetIds.length }
    } else {
      logStatus = 'skipped'
      logDetails = { reason: `action_type "${rule.action_type}" no soportado` }
    }
  } catch (actionErr: any) {
    logStatus = 'failed'
    logDetails = { error: actionErr?.message ?? 'Error desconocido' }
  }

  await supabase.from('automation_logs').insert({
    rule_id:     rule.id,
    rule_name:   rule.name,
    entity_type: 'deal',
    entity_id:   dealId,
    status:      logStatus,
    details:     logDetails,
  })

  await supabase
    .from('automation_rules')
    .update({ run_count: (rule.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
    .eq('id', rule.id)

  return logStatus
}

export async function runAutomationsForStageChange(ctx: AutomationContext) {
  try {
    const { supabase, dealId, toStage, status, ownerId, userId } = ctx

    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('is_active', true)

    if (!rules || rules.length === 0) return

    for (const rule of rules) {
      let triggered = false

      if (rule.trigger_type === 'stage_change' && toStage) {
        const cfg = rule.trigger_config
        triggered = cfg.to_stage === 'any' || cfg.to_stage === toStage
      } else if (rule.trigger_type === 'deal_won' && status === 'won') {
        triggered = true
      } else if (rule.trigger_type === 'deal_lost' && status === 'lost') {
        triggered = true
      }

      if (!triggered) continue

      await executeAutomationAction(supabase, rule, { dealId, ownerId, userId })
    }
  } catch {
    // No bloquear el flujo principal si las automatizaciones fallan
  }
}
