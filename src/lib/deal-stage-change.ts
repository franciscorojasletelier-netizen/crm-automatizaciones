// ============================================================
//  Cambio de etapa de un deal — UNA sola implementación.
//
//  Antes esta lógica vivía copiada en el kanban y en el selector de
//  etapa del detalle del lead, y las copias ya se habían separado: el
//  kanban avisaba al responsable y a gerencia al ganar, el detalle no;
//  los límites de archivo eran distintos; y reemplazar la propuesta en
//  el detalle volvía a disparar automatizaciones de una etapa que no
//  había cambiado. Todo cambio de etapa pasa por acá.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { runAutomationsForStageChange } from '@/lib/automations'
import { type Stage, stageByKey, statusForStage } from '@/lib/stages'
import { notifyManagers } from '@/lib/notify'
import { formatMoney } from '@/lib/format'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { chileDateString } from '@/lib/dates'

export const PROPOSAL_MAX_MB = 15
export const PROPOSAL_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg'

// Sube la propuesta al bucket privado y devuelve los campos del deal que la
// referencian. Se guarda el PATH, no una URL: /api/propuestas la sirve con
// URL firmada tras validar acceso al deal.
export async function uploadProposal(
  supabase: SupabaseClient,
  { organizationId, dealId, file }: { organizationId: string; dealId: string; file: File }
) {
  if (file.size > PROPOSAL_MAX_MB * 1024 * 1024) {
    throw new Error(`El archivo supera el límite de ${PROPOSAL_MAX_MB} MB`)
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${organizationId}/${dealId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('propuestas').upload(path, file, { upsert: true })
  if (error) throw error
  return {
    proposal_url: path,
    proposal_filename: file.name,
    proposal_size: file.size,
    proposal_uploaded_at: new Date().toISOString(),
  }
}

export type StageChangeResult =
  | { ok: false; error: string }
  | { ok: true; status: 'won' | 'lost' | 'open'; warning?: string }

export async function changeDealStage(
  supabase: SupabaseClient,
  {
    dealId, fromStage, toStage, stages, reason = null, comment = null, extraUpdates, currency,
  }: {
    dealId: string
    fromStage: string
    toStage: string
    stages: Stage[]
    reason?: string | null
    comment?: string | null
    extraUpdates?: Record<string, unknown>
    /** Moneda de la organización (para el monto del aviso de deal ganado). */
    currency?: string
  }
): Promise<StageChangeResult> {
  const target = stageByKey(stages, toStage)
  const status = statusForStage(target)

  // status se recalcula siempre: mover a una etapa activa reabre el deal.
  const updates: Record<string, unknown> = { stage: toStage, status, ...extraUpdates }
  if (reason) updates.lost_reason = reason
  if (comment) updates.lost_comment = comment

  const { data: deal, error } = await supabase
    .from('deals').update(updates).eq('id', dealId)
    .select('company_id, estimated_value, owner_id, companies(name)')
    .single()
  if (error || !deal) return { ok: false, error: error?.message ?? 'No se pudo actualizar el deal' }

  // Solo se reemplazó el adjunto: no hay cambio de etapa que notificar
  // ni automatizaciones que correr.
  if (fromStage === toStage) return { ok: true, status }

  const companyName = (deal as { companies?: { name?: string } | null }).companies?.name ?? 'Un deal'
  const ownerId = deal.owner_id as string | null
  const stageLabel = target?.label ?? toStage
  const { data: { user } } = await supabase.auth.getUser()
  const me = user?.id ?? null
  let warning: string | undefined

  // Traspaso comercial → producción. Si falla no puede quedar en silencio:
  // es justo el paso que se vende como automático.
  // Un deal tiene un solo proyecto: si sale de "ganado" y vuelve, no se duplica.
  const { data: existingProject } = target?.createsProject
    ? await supabase.from('projects').select('id').eq('deal_id', dealId).limit(1).maybeSingle()
    : { data: null }
  if (target?.createsProject && !existingProject) {
    // Nombre con el cliente y presupuesto de la cotización aceptada (si la hay).
    const { data: accepted } = await supabase.from('quotes')
      .select('quote_number, items, taxes, tax_rate, currency').eq('deal_id', dealId).eq('status', 'accepted')
      .order('accepted_at', { ascending: false }).limit(1).maybeSingle()
    const quoteTotal = accepted && (accepted.currency ?? 'CLP') === (currency ?? 'CLP')
      ? quoteTotals(accepted.items as QuoteItem[] | null, quoteTaxes(accepted), accepted.currency).total
      : null
    const { error: projectErr } = await supabase.from('projects').insert({
      company_id: deal.company_id, deal_id: dealId, owner_id: ownerId,
      name: accepted ? `${companyName} — Cotización N° ${accepted.quote_number}` : companyName,
      phase: 'discovery', status: 'activo', budget: quoteTotal ?? deal.estimated_value,
      start_date: chileDateString(),
    })
    if (projectErr) {
      warning = `El deal se marcó como ganado pero el proyecto NO se creó automáticamente (${projectErr.message}). Créalo manualmente desde Proyectos.`
      await notifyManagers(supabase, {
        type: 'automation', title: '⚠️ Falló la creación automática de proyecto',
        body: `${companyName} se marcó como ganado pero el proyecto no se pudo crear (${projectErr.message}). Créalo manualmente.`,
        entity_type: 'deal', entity_id: dealId,
      })
    }
  }

  // Gerencia: etapas negativas (con motivo) y deals ganados.
  if (target?.requiresReason && reason) {
    await notifyManagers(supabase, {
      type: 'stage_changed', title: `⚠️ Deal marcado como "${stageLabel}"`,
      body: `${companyName} — Motivo: ${reason}${comment ? `. Detalle: ${comment}` : ''}`,
      entity_type: 'deal', entity_id: dealId,
    }, { exclude: [me] })
  } else if (target?.isWon) {
    const value = deal.estimated_value ? ` · ${formatMoney(deal.estimated_value, currency)}` : ''
    await notifyManagers(supabase, {
      type: 'stage_changed', title: `🎉 Deal GANADO: ${companyName}${value}`,
      body: 'Cerrado exitosamente', entity_type: 'deal', entity_id: dealId,
    }, { exclude: [me, ownerId] })
  }

  // Responsable del deal, si lo movió otra persona.
  if (ownerId && ownerId !== me) {
    const emoji = target?.isWon ? '🎉' : target?.requiresReason ? '⚠️' : '🔄'
    await supabase.from('notifications').insert({
      user_id: ownerId, type: 'stage_changed',
      title: `${emoji} ${companyName} movido a "${stageLabel}"`,
      body: reason ? `Motivo: ${reason}` : 'Tu deal cambió de etapa',
      entity_type: 'deal', entity_id: dealId,
    })
  }

  // En segundo plano: no bloquea la UI.
  void runAutomationsForStageChange({
    supabase, dealId, toStage, status, ownerId: ownerId ?? undefined, userId: me ?? '',
  })

  return { ok: true, status, warning }
}
