'use client'

// Modales del cambio de etapa, compartidos por el kanban y el detalle del
// lead. Antes cada pantalla tenía su propia copia (con límites de archivo
// y textos distintos).

import { useRef, useState } from 'react'
import { X, AlertTriangle, MessageSquare, Loader2, CheckCircle2, Paperclip, Upload, FileText, AlertCircle, Check, Trophy } from 'lucide-react'
import { type Stage, colorOf } from '@/lib/stages'
import { StageIcon } from '@/lib/stage-icons'
import { formatBytes, formatCLP } from '@/lib/format'
import { PROPOSAL_ACCEPT, PROPOSAL_MAX_MB } from '@/lib/deal-stage-change'

const MIN_COMMENT = 10

function ModalShell({ onClose, busy, children, size = 'md' }: {
  onClose: () => void; busy: boolean; children: React.ReactNode; size?: 'sm' | 'md'
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className={`relative w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, busy, children }: { onCancel: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="px-6 pb-6 flex gap-2">
      {children}
      {!busy && (
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          Cancelar
        </button>
      )}
    </div>
  )
}

// ── Motivo obligatorio (etapas con requires_reason) ─────────────
export function ReasonModal({ targetStage, subtitle, onConfirm, onCancel, busy }: {
  targetStage: Stage
  subtitle?: string
  onConfirm: (reason: string, comment: string) => void
  onCancel: () => void
  busy: boolean
}) {
  const c = colorOf(targetStage)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const commentTooShort = comment.trim().length < MIN_COMMENT
  const canSubmit = !!reason && !commentTooShort && !busy

  return (
    <ModalShell onClose={onCancel} busy={busy}>
      <div className={`px-6 py-5 ${c.light} border-b border-slate-200`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
              <StageIcon stage={targetStage} className={`w-5 h-5 ${c.text}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{targetStage.modalTitle ?? `Mover a "${targetStage.label}"`}</h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {targetStage.modalSubtitle ?? subtitle ?? 'Indica el motivo de este cambio.'}
              </p>
            </div>
          </div>
          {!busy && (
            <button onClick={onCancel} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Gerencia será notificada automáticamente con esta información</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Motivo principal *</p>
          <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {targetStage.reasons.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r}
                className={`text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                  reason === r ? `${c.light} border-slate-300 ${c.text} font-semibold` : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {reason === r && <Check className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />}{r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="stage-comment" className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase tracking-wide">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            Comentario adicional * <span className="font-normal normal-case text-slate-400">(mín. {MIN_COMMENT} caracteres)</span>
          </label>
          <textarea id="stage-comment" value={comment} onChange={e => setComment(e.target.value)} onBlur={() => setTouched(true)}
            placeholder="Describe qué ocurrió con este deal para que gerencia entienda la situación..."
            rows={3}
            className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none transition-colors placeholder:text-slate-400 text-slate-800 ${
              touched && commentTooShort ? 'border-red-300 bg-red-50/30 focus:ring-red-200' : 'border-slate-200 bg-slate-50 focus:ring-indigo-200 focus:border-indigo-300'
            }`} />
          <p className={`text-[11px] mt-1 text-right ${commentTooShort ? 'text-slate-400' : 'text-emerald-600'}`}>
            {comment.trim().length} / {MIN_COMMENT} mín.
          </p>
        </div>
      </div>

      <ModalFooter onCancel={onCancel} busy={busy}>
        <button onClick={() => canSubmit && onConfirm(reason, comment.trim())} disabled={!canSubmit}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-md ${c.solid}`}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><StageIcon stage={targetStage} className="w-4 h-4" /> {targetStage.confirmLabel ?? 'Confirmar'}</>}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ── Adjunto obligatorio (etapas con requires_attachment) ───────
// Si se cancela o falla la subida, el deal se queda en su etapa.
export function ProposalModal({ stageLabel, companyName, existingFilename, replacing = false, onConfirm, onCancel, busy }: {
  stageLabel: string
  companyName?: string | null
  existingFilename?: string | null
  /** Solo se cambia el archivo, sin mover el deal de etapa. */
  replacing?: boolean
  onConfirm: (file: File) => void
  onCancel: () => void
  busy: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function pick(f: File) {
    setError('')
    if (f.size > PROPOSAL_MAX_MB * 1024 * 1024) { setError(`El archivo supera el límite de ${PROPOSAL_MAX_MB} MB`); return }
    setFile(f)
  }

  return (
    <ModalShell onClose={onCancel} busy={busy}>
      <div className="px-6 py-5 bg-orange-50 border-b border-orange-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-orange-200 flex items-center justify-center shadow-sm">
              <Paperclip className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {replacing ? 'Reemplazar propuesta' : `Mover a ${stageLabel}`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{companyName ?? 'El documento de propuesta es obligatorio para esta etapa'}</p>
            </div>
          </div>
          {!busy && (
            <button onClick={onCancel} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-3">
        {existingFilename && !file && (
          <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
            <FileText className="w-5 h-5 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-orange-700">Propuesta actual</p>
              <p className="text-xs text-orange-600 truncate">{existingFilename}</p>
            </div>
          </div>
        )}

        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pick(f) }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
            role="button" tabIndex={0}
            className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
              dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-300 hover:border-orange-300 hover:bg-orange-50/50'
            }`}>
            <input ref={inputRef} type="file" accept={PROPOSAL_ACCEPT} className="hidden"
              onChange={e => e.target.files?.[0] && pick(e.target.files[0])} />
            <Upload className={`w-6 h-6 mx-auto mb-2 ${dragOver ? 'text-orange-500' : 'text-slate-300'}`} />
            <p className="text-sm font-semibold text-slate-700">{dragOver ? '¡Suelta aquí!' : 'Arrastra la propuesta aquí'}</p>
            <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar · PDF, Office o imagen · Máx. {PROPOSAL_MAX_MB} MB</p>
          </div>
        ) : (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3.5 flex items-center gap-3">
            <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-900 truncate">{file.name}</p>
              <p className="text-xs text-emerald-600">{formatBytes(file.size)} · listo para subir</p>
            </div>
            {!busy && (
              <button onClick={() => setFile(null)} aria-label="Quitar archivo" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-200 text-emerald-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs font-medium text-red-700">{error}</p>
          </div>
        )}
      </div>

      <ModalFooter onCancel={onCancel} busy={busy}>
        <button onClick={() => file && onConfirm(file)} disabled={!file || busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><CheckCircle2 className="w-4 h-4" /> Adjuntar y confirmar</>}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ── Confirmación de deal ganado ────────────────────────────────
export function WonModal({ companyName, value, createsProject, onConfirm, onCancel, busy }: {
  companyName?: string | null
  value?: number | null
  createsProject: boolean
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <ModalShell onClose={onCancel} busy={busy} size="sm">
      <div className="px-6 py-5 bg-emerald-50 border-b border-emerald-200 text-center">
        <Trophy className="w-8 h-8 text-emerald-600 mx-auto mb-2" aria-hidden />
        <h2 className="text-base font-bold text-slate-900">¡Deal ganado!</h2>
        <p className="text-xs text-slate-500 mt-0.5">{companyName ?? 'Deal'}</p>
        {!!value && <p className="text-lg font-bold text-emerald-700 mt-2 tabular-nums">{formatCLP(value)}</p>}
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-600 text-center leading-relaxed">
          {createsProject ? 'Se creará un proyecto automáticamente y se notificará al equipo.' : 'Se notificará al equipo.'} ¿Confirmar?
        </p>
      </div>
      <ModalFooter onCancel={onCancel} busy={busy}>
        <button onClick={onConfirm} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-colors">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><CheckCircle2 className="w-4 h-4" /> Confirmar ganado</>}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}
