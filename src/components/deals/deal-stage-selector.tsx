'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, XCircle, Upload, FileText, CheckCircle2,
  X, AlertCircle, Paperclip, Eye,
  AlertTriangle, MinusCircle, PauseCircle, MessageSquare,
} from 'lucide-react'
import { runAutomationsForStageChange } from '@/lib/automations'
import { type Stage, stageByKey, colorOf, statusForStage } from '@/lib/stages'
import { stageIcon } from '@/lib/stage-icons'

// Las etapas, sus razones y sus semánticas ya no viven acá: las define
// cada organización en pipeline_stages y llegan por props. Ver src/lib/stages.ts.

const ACCEPTED = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg'
const MAX_MB = 15

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Modal razón obligatoria (etapas con requires_reason) ───────
interface ReasonModalProps {
  targetStage: Stage
  onConfirm: (reason: string, comment: string) => void
  onCancel: () => void
  loading: boolean
}

function ReasonModal({ targetStage, onConfirm, onCancel, loading }: ReasonModalProps) {
  // Textos, razones y colores vienen de la configuración de la etapa.
  const c = colorOf(targetStage)
  const cfg = {
    bgColor: c.light,
    borderColor: 'border-slate-200',
    color: c.text,
    title: targetStage.modalTitle ?? `Cambiar a "${targetStage.label}"`,
    subtitle: targetStage.modalSubtitle ?? 'Indicá el motivo de este cambio.',
    confirmLabel: targetStage.confirmLabel ?? 'Confirmar',
    confirmColor: c.solid,
    reasons: targetStage.reasons,
  }
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const Icon = stageIcon(targetStage)

  const commentError = touched && comment.trim().length < 10
  const canSubmit = reason && comment.trim().length >= 10 && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 ${cfg.bgColor} border-b ${cfg.borderColor}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white border ${cfg.borderColor} flex items-center justify-center shrink-0 shadow-sm`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{cfg.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cfg.subtitle}</p>
              </div>
            </div>
            {!loading && (
              <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Aviso al gerente */}
          <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">
              El gerente será notificado automáticamente con esta información
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Razón predefinida */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              Motivo principal *
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {cfg.reasons.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    reason === r
                      ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} font-semibold`
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {reason === r && <span className="mr-1.5">✓</span>}{r}
                </button>
              ))}
            </div>
          </div>

          {/* Comentario libre obligatorio */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              <MessageSquare className="inline w-3.5 h-3.5 mr-1 text-amber-500" />
              Comentario adicional * <span className="font-normal text-slate-400 normal-case">(mínimo 10 caracteres)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Describe en detalle qué ocurrió con este deal para que el gerente pueda entender la situación..."
              rows={3}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none transition-colors placeholder:text-slate-400 text-slate-800 ${
                commentError
                  ? 'border-red-300 bg-red-50/30 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50 focus:ring-indigo-200 focus:border-indigo-300'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {commentError ? (
                <p className="text-xs text-red-500">Mínimo 10 caracteres requeridos</p>
              ) : <span />}
              <p className={`text-[10px] ml-auto ${comment.length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {comment.length} / 10 mín.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() => { if (canSubmit) onConfirm(reason, comment.trim()) }}
            disabled={!canSubmit}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all ${cfg.confirmColor} hover:shadow-md`}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              : <><Icon className="w-4 h-4" /> {cfg.confirmLabel}</>
            }
          </button>
          {!loading && (
            <button onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal de propuesta ─────────────────────────────────────────
interface ProposalModalProps {
  dealId: string
  onConfirm: (file: File) => Promise<void>
  onCancel: () => void
  uploading: boolean
  existingFilename?: string | null
}

function ProposalModal({ dealId, onConfirm, onCancel, uploading, existingFilename }: ProposalModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setError('')
    if (f.size > MAX_MB * 1024 * 1024) { setError(`El archivo supera el límite de ${MAX_MB} MB`); return }
    setFile(f)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!uploading ? onCancel : undefined} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <Paperclip className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Adjuntar propuesta</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para marcar como <span className="font-semibold text-orange-600">Propuesta Enviada</span> debes adjuntar el documento.
            </p>
          </div>
          {!uploading && (
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {existingFilename && !file && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <FileText className="w-5 h-5 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-700">Propuesta anterior</p>
                <p className="text-xs text-orange-600 truncate">{existingFilename}</p>
              </div>
              <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Reemplazar</span>
            </div>
          )}

          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-orange-400 bg-orange-50 scale-[1.01]' : 'border-slate-300 hover:border-orange-300 hover:bg-orange-50/50'
              }`}>
              <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${dragOver ? 'bg-orange-100' : 'bg-slate-100'}`}>
                <Upload className={`w-6 h-6 ${dragOver ? 'text-orange-500' : 'text-slate-400'}`} />
              </div>
              <p className="text-sm font-semibold text-slate-700">{dragOver ? '¡Suelta aquí!' : 'Arrastra tu propuesta aquí'}</p>
              <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
              <p className="text-[10px] text-slate-300 mt-3">PDF, Word, PowerPoint, Excel · Máx. {MAX_MB} MB</p>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900 truncate">{file.name}</p>
                  <p className="text-xs text-emerald-600">{formatBytes(file.size)}</p>
                </div>
                <button onClick={() => setFile(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-200 text-emerald-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-600">Listo para adjuntar</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button onClick={() => file && onConfirm(file)} disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-md"
            style={{ background: (!file || uploading) ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><CheckCircle2 className="w-4 h-4" /> Confirmar propuesta enviada</>}
          </button>
          {!uploading && (
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
interface Props {
  dealId: string
  currentStage: string
  proposalFilename?: string | null
  proposalUrl?: string | null
  organizationId: string
  stages: Stage[]
}

export default function DealStageSelector({ dealId, currentStage, proposalFilename, proposalUrl, organizationId, stages }: Props) {
  const [stage, setStage] = useState(currentStage)
  useEffect(() => { setStage(currentStage) }, [currentStage])

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Guarda la etapa destino que pidió el adjunto (o la actual, si solo se
  // está reemplazando el archivo). Antes era un booleano y la etapa estaba
  // hardcodeada como 'propuesta_enviada' al confirmar.
  const [showProposalModal, setShowProposalModal] = useState<string | null>(null)
  const [reasonModal, setReasonModal] = useState<string | null>(null) // stage key
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleStageChange(newStage: string) {
    if (newStage === stage) return
    const target = stageByKey(stages, newStage)
    if (target?.requiresAttachment) { setShowProposalModal(newStage); return }
    if (target?.requiresReason) { setReasonModal(newStage); return }
    await applyStageChange(newStage, null, null)
  }

  async function applyStageChange(
    newStage: string,
    reason: string | null,
    comment: string | null,
    extraFields?: Record<string, any>
  ) {
    setLoading(true)
    setError('')

    const target = stageByKey(stages, newStage)

    const updates: Record<string, any> = { stage: newStage, ...extraFields }
    // Antes esto solo escribía `status` al pasar a una etapa cerrada, así que
    // un deal reabierto se quedaba con status='lost' estando en "Negociación".
    // Ahora se recalcula siempre, que es lo que ya hacía el kanban.
    updates.status = statusForStage(target)
    // Guardar razón en lost_reason (sirve para todas las etapas negativas)
    if (reason) updates.lost_reason = reason
    if (comment) updates.lost_comment = comment

    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals').update(updates).eq('id', dealId)
      .select('company_id, estimated_value, owner_id, companies(name)')
      .single()

    if (updateError) {
      setError(updateError.message)
      setStage(currentStage)
      setLoading(false)
      return
    }

    // Auto-crear proyecto si se ganó
    if (target?.createsProject && updatedDeal) {
      await supabase.from('projects').insert({
        company_id: updatedDeal.company_id, deal_id: dealId, owner_id: updatedDeal.owner_id,
        name: `Proyecto - ${new Date().toLocaleDateString('es-CL')}`,
        phase: 'discovery', status: 'activo', budget: updatedDeal.estimated_value,
        start_date: new Date().toISOString().split('T')[0],
      })
    }

    // Notificar a TODOS los gerentes si es etapa negativa
    if (target?.requiresReason && reason) {
      const { data: gerentes } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['gerente', 'super_admin', 'admin'])
        .eq('is_active', true) // ya acotado por RLS a la propia organización

      if (gerentes && gerentes.length > 0) {
        const stageLabel = target?.label ?? newStage
        const companyName = (updatedDeal as any)?.companies?.name ?? 'deal'
        const notifs = gerentes.map((g: any) => ({
          user_id:     g.id,
          type:        'stage_changed',
          title:       `⚠️ Deal marcado como "${stageLabel}"`,
          body:        `${companyName} — Motivo: ${reason}${comment ? `. Detalle: ${comment}` : ''}`,
          entity_type: 'deal',
          entity_id:   dealId,
        }))
        await supabase.from('notifications').insert(notifs)
      }
    }

    setStage(newStage)
    setLoading(false)
    setReasonModal(null)
    router.refresh()

    // Automatizaciones en segundo plano
    if (updatedDeal) {
      const { data: { user } } = await supabase.auth.getUser()
      runAutomationsForStageChange({
        supabase, dealId,
        toStage: newStage,
        status: updates.status,
        ownerId: updatedDeal.owner_id,
        userId: user?.id ?? '',
      })
    }
  }

  async function handleProposalUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const path = `${organizationId}/${dealId}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage
        .from('propuestas').upload(path, file, { upsert: true })
      if (storageError) throw storageError

      // Guardar el PATH (bucket privado) — se sirve vía /api/propuestas con URL firmada
      await applyStageChange(showProposalModal ?? stage, null, null, {
        proposal_url: path,
        proposal_filename: file.name,
        proposal_size: file.size,
        proposal_uploaded_at: new Date().toISOString(),
      })
      setShowProposalModal(null)
    } catch (err: any) {
      setError(`Error subiendo archivo: ${err?.message ?? 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambiar etapa</h2>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stages.map(s => {
            const needsReason = s.requiresReason && s.key !== stage
            const isProposal  = s.requiresAttachment && s.key !== stage
            const c = colorOf(s)
            return (
              <button key={s.key} onClick={() => handleStageChange(s.key)} disabled={loading}
                className={`relative text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
                  stage === s.key ? `${c.solid} text-white ring-1 ${c.ring}` : `${c.light} ${c.text} hover:brightness-95`
                }`}>
                {s.label}
                {/* Indicador de adjunto requerido */}
                {isProposal && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white rounded-full text-[8px] font-black flex items-center justify-center" title="Requiere adjunto">
                    📎
                  </span>
                )}
                {/* Indicador de razón requerida */}
                {needsReason && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[8px] font-black flex items-center justify-center" title="Requiere justificación">
                    ✏️
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Propuesta adjunta actual */}
        {proposalFilename && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Propuesta adjunta</p>
            <div className="flex items-center gap-2.5 p-2.5 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-900 truncate">{proposalFilename}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {proposalUrl && (
                  <a href={`/api/propuestas?deal=${dealId}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-800 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-colors">
                    <Eye className="w-3 h-3" /> Ver
                  </a>
                )}
                <button onClick={() => setShowProposalModal(stage)}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors">
                  <Upload className="w-3 h-3" /> Reemplazar
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}
      </div>

      {/* Modal razón (etapas con requires_reason) */}
      {reasonModal && stageByKey(stages, reasonModal) && (
        <ReasonModal
          targetStage={stageByKey(stages, reasonModal)!}
          onConfirm={(reason, comment) => applyStageChange(reasonModal, reason, comment)}
          onCancel={() => setReasonModal(null)}
          loading={loading}
        />
      )}

      {/* Modal propuesta */}
      {showProposalModal && (
        <ProposalModal
          dealId={dealId}
          onConfirm={handleProposalUpload}
          onCancel={() => { setShowProposalModal(null) }}
          uploading={uploading}
          existingFilename={proposalFilename}
        />
      )}
    </>
  )
}
