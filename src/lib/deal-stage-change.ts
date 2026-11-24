// Cambio de etapa desde el navegador: sube la propuesta (si la etapa la pide)
// y le pide el cambio al servidor. La secuencia completa (deal, proyecto,
// avisos, automatizaciones) vive en deal-stage-change-server.ts.
import type { Db } from '@/lib/supabase/types'

export const PROPOSAL_MAX_MB = 15
export const PROPOSAL_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg'

// Sube la propuesta al bucket privado y devuelve los campos del deal que la
// referencian. Se guarda el PATH, no una URL: /api/propuestas la sirve con
// URL firmada tras validar acceso al deal.
export async function uploadProposal(
  supabase: Db,
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

export type ProposalFields = Awaited<ReturnType<typeof uploadProposal>>

export type StageChangeResult =
  | { ok: false; error: string }
  | { ok: true; status: 'won' | 'lost' | 'open'; warning?: string }

export async function requestStageChange(
  dealId: string,
  body: { toStage: string; reason?: string | null; comment?: string | null; proposal?: ProposalFields },
): Promise<StageChangeResult> {
  try {
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'No se pudo cambiar la etapa' }
    return data as StageChangeResult
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor' }
  }
}
