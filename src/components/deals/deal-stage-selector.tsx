'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, FileText, Eye, Upload, Paperclip, PenLine } from 'lucide-react'
import { type Stage, stageByKey, colorOf } from '@/lib/stages'
import { changeDealStage, uploadProposal } from '@/lib/deal-stage-change'
import { ReasonModal, ProposalModal, WonModal } from '@/components/deals/stage-change-modals'

// Las etapas, sus razones y sus semánticas las define cada organización en
// pipeline_stages. La lógica del cambio vive en src/lib/deal-stage-change.ts,
// compartida con el kanban.

interface Props {
  dealId: string
  currentStage: string
  proposalFilename?: string | null
  proposalUrl?: string | null
  organizationId: string
  stages: Stage[]
  companyName?: string | null
  estimatedValue?: number | null
}

type Pending =
  | { kind: 'reason'; stage: string }
  | { kind: 'proposal'; stage: string; replacing: boolean }
  | { kind: 'won'; stage: string }

export default function DealStageSelector({
  dealId, currentStage, proposalFilename, proposalUrl, organizationId, stages, companyName, estimatedValue,
}: Props) {
  const [stage, setStage] = useState(currentStage)
  // Si el servidor trae otra etapa (router.refresh, otra pestaña), se adopta.
  const [lastServerStage, setLastServerStage] = useState(currentStage)
  if (currentStage !== lastServerStage) {
    setLastServerStage(currentStage)
    setStage(currentStage)
  }

  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function requestChange(newStage: string) {
    if (newStage === stage || busy) return
    const target = stageByKey(stages, newStage)
    if (target?.isWon)              return setPending({ kind: 'won', stage: newStage })
    if (target?.requiresAttachment) return setPending({ kind: 'proposal', stage: newStage, replacing: false })
    if (target?.requiresReason)     return setPending({ kind: 'reason', stage: newStage })
    void apply(newStage)
  }

  async function apply(newStage: string, opts: { reason?: string; comment?: string; extraUpdates?: Record<string, unknown> } = {}) {
    setBusy(true)
    setError('')
    const result = await changeDealStage(supabase, {
      dealId, fromStage: stage, toStage: newStage, stages, ...opts,
    })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    if (result.warning) setError(result.warning)
    setStage(newStage)
    setPending(null)
    router.refresh()
  }

  async function handleProposal(file: File, targetStage: string) {
    setBusy(true)
    setError('')
    try {
      const extraUpdates = await uploadProposal(supabase, { organizationId, dealId, file })
      await apply(targetStage, { extraUpdates })
    } catch (err) {
      setError(`Error subiendo archivo: ${err instanceof Error ? err.message : 'desconocido'} — la etapa no cambió`)
      setBusy(false)
    }
  }

  const pendingStage = pending ? stageByKey(stages, pending.stage) : null

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambiar etapa</h2>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stages.map(s => {
            const isCurrent = stage === s.key
            const c = colorOf(s)
            const hint = !isCurrent && (s.requiresAttachment ? 'Requiere adjunto' : s.requiresReason ? 'Requiere justificación' : null)
            return (
              <button key={s.key} onClick={() => requestChange(s.key)} disabled={busy}
                aria-pressed={isCurrent} title={hint || undefined}
                className={`relative text-xs px-3 py-1.5 rounded-xl font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                  isCurrent ? `${c.solid} text-white ring-1 ${c.ring}` : `${c.light} ${c.text} hover:brightness-95`
                }`}>
                {s.label}
                {hint && (
                  <span aria-hidden className={`absolute -top-1.5 -right-1.5 w-4 h-4 text-white rounded-full text-[11px] flex items-center justify-center ${
                    s.requiresAttachment ? 'bg-orange-500' : 'bg-amber-500'
                  }`}>
                    {s.requiresAttachment ? <Paperclip className="w-2.5 h-2.5" /> : <PenLine className="w-2.5 h-2.5" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {proposalFilename && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Propuesta adjunta</p>
            <div className="flex items-center gap-2.5 p-2.5 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-orange-600" />
              </div>
              <p className="flex-1 min-w-0 text-xs font-semibold text-orange-900 truncate">{proposalFilename}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {proposalUrl && (
                  <a href={`/api/propuestas?deal=${dealId}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-800 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-colors">
                    <Eye className="w-3 h-3" /> Ver
                  </a>
                )}
                <button onClick={() => setPending({ kind: 'proposal', stage, replacing: true })}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors">
                  <Upload className="w-3 h-3" /> Reemplazar
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}
      </div>

      {pending?.kind === 'reason' && pendingStage && (
        <ReasonModal targetStage={pendingStage} busy={busy}
          onConfirm={(reason, comment) => apply(pending.stage, { reason, comment })}
          onCancel={() => setPending(null)} />
      )}

      {pending?.kind === 'proposal' && (
        <ProposalModal stageLabel={pendingStage?.label ?? pending.stage} replacing={pending.replacing}
          existingFilename={proposalFilename} busy={busy}
          onConfirm={file => handleProposal(file, pending.stage)}
          onCancel={() => setPending(null)} />
      )}

      {pending?.kind === 'won' && (
        <WonModal companyName={companyName} value={estimatedValue} createsProject={!!pendingStage?.createsProject} busy={busy}
          onConfirm={() => apply(pending.stage)}
          onCancel={() => setPending(null)} />
      )}
    </>
  )
}
