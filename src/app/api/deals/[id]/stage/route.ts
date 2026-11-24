import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'
import { getStages, stageByKey } from '@/lib/stages'
import { changeDealStage } from '@/lib/deal-stage-change-server'
import type { ProposalFields } from '@/lib/deal-stage-change'

// Cambia la etapa de un deal. La etapa de origen y las reglas de la etapa
// destino (motivo obligatorio, adjunto obligatorio) se leen de la base, no
// del navegador. Las escrituras van con la sesión: la RLS decide si el
// usuario puede modificar este deal.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, role, supabase, organizationId, currency } = await getCurrentProfile()

  const body = await request.json().catch(() => null) as
    { toStage?: string; reason?: string | null; comment?: string | null; proposal?: ProposalFields } | null
  const toStage = String(body?.toStage ?? '')
  if (!toStage) return NextResponse.json({ ok: false, error: 'Falta la etapa de destino' }, { status: 400 })

  if (!(await canSeeDeal(supabase, user.id, role, id))) {
    return NextResponse.json({ ok: false, error: 'Sin acceso a este deal' }, { status: 403 })
  }
  const { data: deal } = await supabase.from('deals')
    .select('id, stage, pipeline_id, organization_id, proposal_url').eq('id', id).maybeSingle()
  if (!deal) return NextResponse.json({ ok: false, error: 'Deal no encontrado' }, { status: 404 })

  const stages = await getStages(supabase, organizationId ?? undefined, deal.pipeline_id)
  const target = stageByKey(stages, toStage)
  if (!target) return NextResponse.json({ ok: false, error: 'La etapa no existe en el pipeline de este deal' }, { status: 400 })

  const reason = body?.reason?.trim().slice(0, 200) || null
  const comment = body?.comment?.trim().slice(0, 2000) || null
  if (target.requiresReason && !reason) {
    return NextResponse.json({ ok: false, error: `Para mover a "${target.label}" hay que indicar un motivo` }, { status: 400 })
  }

  // La propuesta la sube el navegador al bucket; acá solo se acepta si quedó
  // en la carpeta de este deal.
  const p = body?.proposal
  let extraUpdates: ProposalFields | undefined
  if (p) {
    if (typeof p.proposal_url !== 'string' || !p.proposal_url.startsWith(`${deal.organization_id}/${id}/`)) {
      return NextResponse.json({ ok: false, error: 'Archivo de propuesta no válido' }, { status: 400 })
    }
    extraUpdates = {
      proposal_url: p.proposal_url,
      proposal_filename: String(p.proposal_filename ?? '').slice(0, 255),
      proposal_size: Number(p.proposal_size) || 0,
      proposal_uploaded_at: new Date().toISOString(),
    }
  }
  // Igual que en la ficha: una cotización enviada o aceptada reemplaza al adjunto.
  if (target.requiresAttachment && !extraUpdates && !deal.proposal_url) {
    const { count } = await supabase.from('quotes').select('id', { count: 'exact', head: true })
      .eq('deal_id', id).in('status', ['sent', 'accepted'])
    if (!count) {
      return NextResponse.json({ ok: false, error: `Para mover a "${target.label}" hay que adjuntar la propuesta` }, { status: 400 })
    }
  }

  const result = await changeDealStage(supabase, {
    dealId: id, fromStage: deal.stage, toStage, stages, reason, comment, extraUpdates, currency,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
