'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { runAutomationsForStageChange } from '@/lib/automations'
import { formatCLP } from '@/lib/format'
import { useRef } from 'react'
import {
  X, AlertTriangle, MessageSquare, Loader2, CheckCircle2, Paperclip, Upload, FileText,
} from 'lucide-react'
import { type Stage, stageByKey, colorOf, statusForStage, boardStages, terminalStages } from '@/lib/stages'
import { stageIcon } from '@/lib/stage-icons'

// ── Tipos ──────────────────────────────────────────────────────
export type KanbanDeal = {
  id: string
  stage: string
  score: number | null
  estimated_value: number | null
  next_action: string | null
  last_contacted_at?: string | null
  created_at?: string | null
  companies: { name: string } | null
  contacts: { full_name: string } | null
  profiles: { full_name: string } | null
}

// Deal estancado: 7+ días sin contacto registrado (patrón Salesforce Pipeline Inspection)
function staleDays(deal: KanbanDeal): number {
  const ref = deal.last_contacted_at ?? deal.created_at
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
}
function isStalled(deal: KanbanDeal): boolean {
  return staleDays(deal) >= 7
}

// Las etapas ya no viven acá: las define cada organización en
// pipeline_stages y llegan por props. Ver src/lib/stages.ts.
//
// Las columnas del tablero son las etapas NO terminales; las terminales
// van en la bandeja de cierre (patrón Pipedrive). Antes eso eran los
// arrays TERMINAL_STAGES / ACTIVE_STAGES / TRAY_ZONES hardcodeados.

// Emoji de la bandeja de cierre, derivado del color como los iconos.
const TRAY_EMOJI: Record<string, string> = {
  green: '🏆', emerald: '🏆',
  red: '✕', rose: '✕',
  gray: '⊘',
  slate: '❄️',
}

// ── Modal razón ───────────────────────────────────────────────
function ReasonModal({
  targetStage, onConfirm, onCancel, saving,
}: { targetStage: Stage; onConfirm: (r: string, c: string) => void; onCancel: () => void; saving: boolean }) {
  // Textos, razones y colores vienen de la configuración de la etapa.
  const c = colorOf(targetStage)
  const cfg = {
    bg: c.light,
    border: 'border-slate-200',
    color: c.text,
    btnColor: c.solid,
    title: targetStage.modalTitle ?? `Mover a "${targetStage.label}"`,
    subtitle: targetStage.modalSubtitle ?? 'Indicá el motivo de este cambio.',
    confirmLabel: targetStage.confirmLabel ?? 'Confirmar',
    reasons: targetStage.reasons,
  }
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const Icon = stageIcon(targetStage)
  const canSubmit = reason && comment.trim().length >= 10 && !saving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`px-6 py-5 ${cfg.bg} border-b ${cfg.border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white border ${cfg.border} flex items-center justify-center shadow-sm`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{cfg.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{cfg.subtitle}</p>
              </div>
            </div>
            {!saving && (
              <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">El gerente será notificado automáticamente</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Motivo principal *</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {cfg.reasons.map(r => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={`text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    reason === r ? `${cfg.bg} ${cfg.border} ${cfg.color} font-semibold` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {reason === r && <span className="mr-1">✓</span>}{r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase tracking-wide">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              Comentario adicional * <span className="font-normal normal-case text-slate-400">(mín. 10 caracteres)</span>
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} onBlur={() => setTouched(true)}
              placeholder="Describe en detalle qué ocurrió..."
              rows={3}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none placeholder:text-slate-400 ${
                touched && comment.trim().length < 10 ? 'border-red-300 bg-red-50/30 focus:ring-red-200' : 'border-slate-200 bg-slate-50 focus:ring-indigo-200'
              }`} />
            <p className={`text-[10px] mt-1 text-right ${comment.length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {comment.length} / 10 mín.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button onClick={() => canSubmit && onConfirm(reason, comment.trim())} disabled={!canSubmit}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 ${cfg.btnColor}`}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Icon className="w-4 h-4" /> {cfg.confirmLabel}</>}
          </button>
          {!saving && (
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal para Propuesta Enviada — ADJUNTO OBLIGATORIO ─────────
// Si el usuario cancela o no adjunta, el deal se queda en su etapa anterior.
const MAX_PROPOSAL_MB = 10
const PROPOSAL_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx'

function ProposalUploadModal({ deal, onConfirm, onCancel, saving }: {
  deal: KanbanDeal; onConfirm: (file: File) => void; onCancel: () => void; saving: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFileError('')
    if (f.size > MAX_PROPOSAL_MB * 1024 * 1024) {
      setFileError(`El archivo supera el límite de ${MAX_PROPOSAL_MB} MB`)
      return
    }
    setFile(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-orange-50 border-b border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-orange-200 flex items-center justify-center shadow-sm">
              <Paperclip className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Mover a Propuesta Enviada</h2>
              <p className="text-xs text-slate-500 mt-0.5">{deal.companies?.name ?? 'Deal'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-white border border-orange-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p className="text-xs font-semibold text-orange-700">El documento de propuesta es obligatorio para esta etapa</p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
                dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-300 hover:border-orange-300 hover:bg-orange-50/50'
              }`}
            >
              <input ref={inputRef} type="file" accept={PROPOSAL_ACCEPT} className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Upload className={`w-6 h-6 mx-auto mb-2 ${dragOver ? 'text-orange-500' : 'text-slate-300'}`} />
              <p className="text-sm font-semibold text-slate-700">{dragOver ? '¡Suelta aquí!' : 'Arrastra la propuesta aquí'}</p>
              <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar · PDF, Word, PowerPoint · Máx. {MAX_PROPOSAL_MB} MB</p>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3.5 flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-900 truncate">{file.name}</p>
                <p className="text-xs text-emerald-600">{(file.size / 1024 / 1024).toFixed(1)} MB · listo para subir</p>
              </div>
              {!saving && (
                <button onClick={() => setFile(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-200 text-emerald-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {fileError && (
            <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fileError}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button onClick={() => file && onConfirm(file)} disabled={!file || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: (!file || saving) ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><CheckCircle2 className="w-4 h-4" /> Adjuntar y mover</>}
          </button>
          {!saving && (
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal para Ganado ─────────────────────────────────────────
function GanadoModal({ deal, onConfirm, onCancel, saving }: {
  deal: KanbanDeal; onConfirm: () => void; onCancel: () => void; saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-green-50 border-b border-green-200 text-center">
          <p className="text-4xl mb-2">🎉</p>
          <h2 className="text-base font-bold text-slate-900">¡Deal ganado!</h2>
          <p className="text-xs text-slate-500 mt-0.5">{deal.companies?.name ?? 'Deal'}</p>
          {deal.estimated_value && (
            <p className="text-lg font-bold text-green-700 mt-2">{formatCLP(deal.estimated_value)}</p>
          )}
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 text-center leading-relaxed">
            Se creará un proyecto automáticamente y se notificará al equipo. ¿Confirmar?
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onConfirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><CheckCircle2 className="w-4 h-4" /> Confirmar ganado</>}
          </button>
          {!saving && (
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal selector de etapa (móvil) ──────────────────────────
function MobileStagePickerModal({ deal, currentStage, stages, onSelect, onCancel }: {
  deal: KanbanDeal; currentStage: string; stages: Stage[]; onSelect: (stage: string) => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mover deal</p>
          <p className="text-sm font-bold text-slate-900 truncate">{deal.companies?.name ?? 'Deal'}</p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pb-8"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {boardStages(stages).map(s => {
            const isCurrent = s.key === currentStage
            const c = colorOf(s)
            return (
              <button key={s.key} onClick={() => !isCurrent && onSelect(s.key)} disabled={isCurrent}
                className={`flex items-center gap-2 px-3 py-3 rounded-2xl text-sm font-semibold border-2 transition-all text-left ${
                  isCurrent
                    ? `${c.light} ${c.text} border-current opacity-60 cursor-default`
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 active:scale-95'
                }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
                <span className="leading-tight">{s.label}</span>
                {isCurrent && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function KanbanBoard({ initialDeals, readOnly, organizationId, stages }: { initialDeals: KanbanDeal[]; readOnly?: boolean; organizationId: string; stages: Stage[] }) {
  const columnStages = boardStages(stages)   // no terminales → columnas
  const trayStages   = terminalStages(stages) // terminales → bandeja de cierre

  const [deals, setDeals] = useState<KanbanDeal[]>(initialDeals)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // Modales pendientes
  const [reasonModal,   setReasonModal]   = useState<{ deal: KanbanDeal; stage: string } | null>(null)
  const [proposalModal, setProposalModal] = useState<{ deal: KanbanDeal; stage: string } | null>(null)
  const [ganadoModal,   setGanadoModal]   = useState<{ deal: KanbanDeal; stage: string } | null>(null)
  const [mobilePicker,  setMobilePicker]  = useState<KanbanDeal | null>(null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [showClosed, setShowClosed] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')

  // Agrupar por etapa
  const byStage: Record<string, KanbanDeal[]> = {}
  for (const s of stages) {
    byStage[s.key] = deals.filter(d => d.stage === s.key)
  }
  const isTerminal = (key: string) => !!stageByKey(stages, key)?.isTerminal
  const closedDeals = deals.filter(d => isTerminal(d.stage))
  const activeList  = deals.filter(d => !isTerminal(d.stage))
  const stalledCount = activeList.filter(isStalled).length

  // ── Drag handlers ──────────────────────────────────────────
  function onDragStart(e: React.DragEvent, deal: KanbanDeal) {
    if (readOnly) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dealId', deal.id)

    // Imagen de arrastre personalizada — mini chip con nombre empresa
    const ghost = document.createElement('div')
    ghost.style.cssText = [
      'position:fixed', 'top:-200px', 'left:-200px',
      'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
      'color:white', 'padding:8px 14px', 'border-radius:12px',
      'font-size:13px', 'font-weight:700', 'white-space:nowrap',
      'box-shadow:0 8px 24px rgba(99,102,241,0.4)',
      'pointer-events:none', 'z-index:9999',
    ].join(';')
    ghost.textContent = `✦ ${deal.companies?.name ?? 'Deal'}`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 20)
    // Limpiar el elemento ghost después de un tick
    setTimeout(() => document.body.removeChild(ghost), 0)

    setDraggingId(deal.id)
  }
  function onDragEnd() {
    setDraggingId(null)
    setDragOverStage(null)
  }
  function onDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageKey)
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null)
  }
  function onDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault()
    setDragOverStage(null)
    if (readOnly) return
    // Guardar id antes de limpiar el estado
    const dealId = e.dataTransfer.getData('dealId') || draggingId
    setDraggingId(null)  // limpiar inmediatamente → card se ve normal al soltar
    if (!dealId) return
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return
    handleMoveRequest(deal, targetStage)
  }

  function handleMoveRequest(deal: KanbanDeal, targetStage: string) {
    const target = stageByKey(stages, targetStage)
    if (target?.isWon)              { setGanadoModal({ deal, stage: targetStage }); return }
    if (target?.requiresReason)     { setReasonModal({ deal, stage: targetStage }); return }
    if (target?.requiresAttachment) { setProposalModal({ deal, stage: targetStage }); return }
    applyMove(deal, targetStage, null, null)
  }

  // Subir propuesta a Storage y luego mover — el deal NO se mueve si falla la subida
  async function handleProposalConfirm(deal: KanbanDeal, targetStage: string, file: File) {
    setSaving(true)
    setError('')
    try {
      const path = `${organizationId}/${deal.id}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage
        .from('propuestas').upload(path, file, { upsert: true })
      if (storageError) throw storageError
      // Guardar el PATH (bucket privado) — se sirve vía /api/propuestas con URL firmada
      await applyMove(deal, targetStage, null, null, {
        proposal_url: path,
        proposal_filename: file.name,
        proposal_size: file.size,
        proposal_uploaded_at: new Date().toISOString(),
      })
    } catch (err: any) {
      setError(`Error subiendo propuesta: ${err?.message ?? 'desconocido'} — el deal no se movió`)
      setSaving(false)
      setProposalModal(null)
    }
  }

  // ── Apply move ─────────────────────────────────────────────
  async function applyMove(deal: KanbanDeal, targetStage: string, reason: string | null, comment: string | null, extraUpdates?: Record<string, any>) {
    setSaving(true)
    setError('')

    // Optimistic update
    const prevStage = deal.stage
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d))

    const target = stageByKey(stages, targetStage)

    const updates: Record<string, any> = { stage: targetStage, ...(extraUpdates ?? {}) }
    // Mover a una etapa activa reabre el deal (permite rescatar desde cerrados).
    updates.status = statusForStage(target)
    if (reason)  updates.lost_reason  = reason
    if (comment) updates.lost_comment = comment

    const { data: updatedDeal, error: err } = await supabase
      .from('deals').update(updates).eq('id', deal.id)
      .select('company_id, estimated_value, owner_id, companies(name)')
      .single()

    if (err) {
      // Revert
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: prevStage } : d))
      setError('Error al actualizar: ' + err.message)
      setSaving(false)
      setReasonModal(null); setProposalModal(null); setGanadoModal(null)
      return
    }

    // Auto-crear proyecto si la etapa lo pide
    if (target?.createsProject && updatedDeal) {
      await supabase.from('projects').insert({
        company_id: updatedDeal.company_id,
        deal_id: deal.id,
        owner_id: updatedDeal.owner_id,
        name: `Proyecto - ${new Date().toLocaleDateString('es-CL')}`,
        phase: 'discovery', status: 'activo',
        budget: updatedDeal.estimated_value,
        start_date: new Date().toISOString().split('T')[0],
      })
    }

    // ── Notificaciones de etapa ────────────────────────────────
    const stageLabel    = target?.label ?? targetStage
    const companyName   = (updatedDeal as any)?.companies?.name ?? 'deal'
    const ownerId       = (updatedDeal as any)?.owner_id ?? null
    const { data: { user: meUser } } = await supabase.auth.getUser()

    // A) Notificar gerentes si etapa negativa
    if (target?.requiresReason && reason) {
      const { data: gerentes } = await supabase
        .from('profiles').select('id')
        .in('role', ['gerente', 'super_admin', 'admin']).eq('is_active', true)
      if (gerentes?.length) {
        await supabase.from('notifications').insert(
          gerentes.map((g: any) => ({
            user_id: g.id, type: 'stage_changed',
            title: `⚠️ Deal marcado como "${stageLabel}"`,
            body: `${companyName} — Motivo: ${reason}${comment ? `. ${comment}` : ''}`,
            entity_type: 'deal', entity_id: deal.id,
          }))
        )
      }
    }

    // B) Notificar al owner si la etapa cambió (y no es él mismo quien mueve)
    if (ownerId && ownerId !== meUser?.id) {
      const emoji = target?.isWon ? '🎉'
                  : target?.requiresReason ? '⚠️'
                  : '🔄'
      await supabase.from('notifications').insert({
        user_id:     ownerId,
        type:        'stage_changed',
        title:       `${emoji} ${companyName} movido a "${stageLabel}"`,
        body:        reason ? `Motivo: ${reason}` : `Tu deal cambió de etapa`,
        entity_type: 'deal',
        entity_id:   deal.id,
      })
    }

    // C) Notificar a todos los gerentes si deal ganado
    if (target?.isWon) {
      const { data: gerentes } = await supabase
        .from('profiles').select('id')
        .in('role', ['gerente', 'super_admin', 'admin']).eq('is_active', true)
      if (gerentes?.length) {
        const valueStr = updatedDeal?.estimated_value
          ? ` · ${formatCLP(updatedDeal.estimated_value)}`
          : ''
        await supabase.from('notifications').insert(
          gerentes.filter((g: any) => g.id !== meUser?.id && g.id !== ownerId)
            .map((g: any) => ({
              user_id: g.id, type: 'stage_changed',
              title: `🎉 Deal GANADO: ${companyName}${valueStr}`,
              body: `Cerrado exitosamente`,
              entity_type: 'deal', entity_id: deal.id,
            }))
        )
      }
    }

    // Ejecutar automatizaciones en segundo plano (no bloquea UI)
    runAutomationsForStageChange({
      supabase,
      dealId:  deal.id,
      toStage: targetStage,
      status:  updates.status as 'won' | 'lost' | 'open' | undefined,
      ownerId: ownerId ?? undefined,
      userId:  meUser?.id ?? '',
    })

    setSaving(false)
    setReasonModal(null); setProposalModal(null); setGanadoModal(null)
    router.refresh()
  }

  const draggingDeal = draggingId ? deals.find(d => d.id === draggingId) : null

  return (
    <>
      {error && (
        <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl">
          <X className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Barra de herramientas: instrucción + estancados + toggle de vista */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-xs text-slate-400 font-medium flex-1 min-w-[200px]">
          {view === 'board'
            ? <>💡 Arrastra las tarjetas entre columnas. Para cerrar un deal, suéltalo en la <span className="font-bold text-slate-500">bandeja de cierre</span> que aparece abajo.</>
            : <>📋 Vista de lista — los mismos deals del tablero, ordenados por valor.</>
          }
        </p>

        {stalledCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-xl">
            🔥 {stalledCount} estancado{stalledCount > 1 ? 's' : ''} (7d+ sin contacto)
          </span>
        )}

        {/* Toggle Tablero / Lista (patrón HubSpot) */}
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          {([['board', 'Tablero'], ['list', 'Lista']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                view === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista LISTA (patrón HubSpot: tabla sincronizada con el tablero) ── */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Empresa', 'Etapa', 'Valor', 'Score', 'Responsable', 'Próxima acción', 'Últ. contacto', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...activeList].sort((a, b) => (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0)).map(deal => {
                // Antes era ALL_STAGES.find(...)! y una etapa desconocida
                // rompía la página entera. colorOf degrada a slate.
                const st = stageByKey(stages, deal.stage)
                const c = colorOf(st)
                const stalled = isStalled(deal)
                const days = staleDays(deal)
                return (
                  <tr key={deal.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{deal.companies?.name ?? 'Sin empresa'}</span>
                        {stalled && <span className="text-[10px]">🔥</span>}
                      </div>
                      {deal.contacts?.full_name && <p className="text-[11px] text-slate-400">{deal.contacts.full_name}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold ${c.light} ${c.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {st?.label ?? deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 tabular-nums">
                      {deal.estimated_value ? formatCLP(deal.estimated_value) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold ${(deal.score ?? 0) >= 60 ? 'text-emerald-600' : (deal.score ?? 0) >= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {deal.score ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 font-medium">{deal.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{deal.next_action ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold ${stalled ? 'text-red-500' : days >= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${deal.id}`}
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-indigo-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                        <span className="text-[10px] font-bold">→</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Kanban Board — solo etapas activas */}
      {view === 'board' && (
      <div className="flex gap-2.5 overflow-x-auto pb-4 flex-1 items-start select-none scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        {columnStages.map(stage => {
          const stageDeals = byStage[stage.key] ?? []
          const isOver = dragOverStage === stage.key
          const needsReason = stage.requiresReason
          const isProposal = stage.requiresAttachment
          const isGanado   = stage.isWon
          const c = colorOf(stage)

          return (
            <div key={stage.key} className="flex flex-col flex-shrink-0 w-[170px] sm:w-[190px] md:flex-1 md:min-w-[190px]">

              {/* Column header */}
              <div className="flex items-center gap-1.5 mb-2.5 px-1">
                <div className={`w-2.5 h-2.5 rounded-full ${c.dot} shadow-sm flex-shrink-0`} />
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex-1 truncate">
                  {stage.label}
                  {needsReason && <span className="ml-1 text-amber-500" title="Requiere justificación">✏️</span>}
                  {isProposal  && <span className="ml-1 text-orange-400" title="Requiere propuesta adjunta">📎</span>}
                  {isGanado    && <span className="ml-1">🏆</span>}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.light} ${c.text}`}>
                  {stageDeals.length}
                </span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => onDragOver(e, stage.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, stage.key)}
                className={`flex flex-col gap-2 min-h-[100px] rounded-xl p-1.5 transition-all duration-150 ${
                  isOver
                    ? `ring-2 ${c.ring} bg-white shadow-lg scale-[1.01]`
                    : 'ring-1 ring-transparent'
                }`}
              >
                {stageDeals.length === 0 ? (
                  <div className={`border-2 border-dashed rounded-xl h-20 flex items-center justify-center transition-colors ${
                    isOver ? `${c.light} border-current ${c.text}` : 'border-slate-200 bg-white/50'
                  }`}>
                    <p className={`text-xs font-medium ${isOver ? c.text : 'text-slate-300'}`}>
                      {isOver ? 'Soltar aquí' : 'Sin deals'}
                    </p>
                  </div>
                ) : (
                  stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable={!readOnly}
                      onDragStart={e => onDragStart(e, deal)}
                      onDragEnd={onDragEnd}
                      className={`rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-150 relative overflow-hidden group ${
                        draggingId === deal.id
                          ? 'border-2 border-dashed border-indigo-300 bg-indigo-50/50 shadow-none'
                          : 'bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      {/* Barra color top — roja si está estancado */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${isStalled(deal) ? 'bg-red-400' : stage.color}`} />

                      {/* Empresa */}
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-900 leading-tight truncate group-hover:text-indigo-700 transition-colors">
                          {deal.companies?.name ?? 'Sin empresa'}
                        </p>
                        {isStalled(deal) && (
                          <span className="text-[10px] shrink-0" title={`${staleDays(deal)} días sin contacto`}>🔥</span>
                        )}
                      </div>

                      {/* Contacto */}
                      {deal.contacts?.full_name && (
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium truncate">{deal.contacts.full_name}</p>
                      )}

                      {/* Valor */}
                      {deal.estimated_value && (
                        <p className="text-sm font-bold text-slate-700 mt-2">
                          {formatCLP(deal.estimated_value)}
                        </p>
                      )}

                      {/* Próxima acción */}
                      {deal.next_action && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight line-clamp-2">
                          → {deal.next_action}
                        </p>
                      )}

                      {/* Score + owner */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              (deal.score ?? 0) >= 60 ? 'bg-emerald-500' :
                              (deal.score ?? 0) >= 30 ? 'bg-yellow-500' : 'bg-slate-300'
                            }`} style={{ width: `${Math.min(deal.score ?? 0, 100)}%` }} />
                          </div>
                          <span className={`text-[9px] font-bold tabular-nums ${
                            (deal.score ?? 0) >= 60 ? 'text-emerald-600' :
                            (deal.score ?? 0) >= 30 ? 'text-yellow-600' : 'text-slate-400'
                          }`}>{deal.score ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {deal.profiles?.full_name && (
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-indigo-600">
                                {deal.profiles.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          {/* Botón Mover — solo visible en móvil */}
                          <button
                            onClick={e => { e.stopPropagation(); e.preventDefault(); setMobilePicker(deal) }}
                            className="md:hidden text-[9px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 active:scale-95 transition-all"
                            title="Cambiar etapa"
                          >
                            Mover
                          </button>
                          {/* Link al detalle */}
                          <Link
                            href={`/leads/${deal.id}`}
                            onClick={e => e.stopPropagation()}
                            className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                            title="Ver detalle"
                          >
                            <span className="text-[9px] font-bold">→</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Indicador "soltar aquí" cuando hay deals */}
                {isOver && stageDeals.length > 0 && (
                  <div className={`border-2 border-dashed rounded-xl h-12 flex items-center justify-center ${c.light} border-current ${c.text}`}>
                    <p className="text-xs font-semibold">Soltar aquí</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* ── Bandeja de cierre (patrón Pipedrive) — aparece al arrastrar ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-200 ease-out ${
          draggingId ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white/95 backdrop-blur border-t-2 border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] px-4 py-3">
          <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {trayStages.map(zone => {
              const isOver = dragOverStage === zone.key
              const c = colorOf(zone)
              return (
                <div
                  key={zone.key}
                  onDragOver={e => onDragOver(e, zone.key)}
                  onDragLeave={onDragLeave}
                  onDrop={e => onDrop(e, zone.key)}
                  className={`flex flex-col items-center justify-center gap-0.5 h-16 rounded-2xl border-2 border-dashed font-bold text-xs tracking-wider transition-all duration-150 ${
                    isOver
                      ? `${c.solid} text-white scale-105 border-transparent`
                      : `${c.light} ${c.text} border-current/40`
                  }`}
                >
                  <span className="text-lg leading-none">{TRAY_EMOJI[zone.color] ?? '•'}</span>
                  {zone.label.toUpperCase()}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Cerrados recientes (colapsable) ── */}
      {closedDeals.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-3">
          <button
            onClick={() => setShowClosed(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider"
          >
            <span className={`transition-transform duration-150 ${showClosed ? 'rotate-90' : ''}`}>▸</span>
            Cerrados recientes
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full normal-case">{closedDeals.length}</span>
            <span className="font-medium text-slate-400 normal-case tracking-normal">— arrastra de vuelta al pipeline para reabrir</span>
          </button>

          {showClosed && (
            <div className="flex flex-wrap gap-2 mt-3">
              {closedDeals.map(deal => {
                const st = stageByKey(stages, deal.stage)
                const c = colorOf(st)
                return (
                  <div
                    key={deal.id}
                    draggable={!readOnly}
                    onDragStart={e => onDragStart(e, deal)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${
                      draggingId === deal.id
                        ? 'border-dashed border-indigo-300 bg-indigo-50/50 opacity-60'
                        : `bg-white border-slate-200 hover:border-slate-300`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`} />
                    <span className="text-xs font-bold text-slate-700">{deal.companies?.name ?? 'Deal'}</span>
                    {deal.estimated_value && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {formatCLP(deal.estimated_value)}
                      </span>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${c.light} ${c.text}`}>{st?.label ?? deal.stage}</span>
                    <Link
                      href={`/leads/${deal.id}`}
                      onClick={e => e.stopPropagation()}
                      className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                    >
                      <span className="text-[9px] font-bold">→</span>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────── */}

      {/* Razón (etapas con requires_reason) */}
      {reasonModal && stageByKey(stages, reasonModal.stage) && (
        <ReasonModal
          targetStage={stageByKey(stages, reasonModal.stage)!}
          saving={saving}
          onConfirm={(reason, comment) => applyMove(reasonModal.deal, reasonModal.stage, reason, comment)}
          onCancel={() => setReasonModal(null)}
        />
      )}

      {/* Adjunto obligatorio (etapas con requires_attachment) */}
      {proposalModal && (
        <ProposalUploadModal
          deal={proposalModal.deal}
          saving={saving}
          onConfirm={file => handleProposalConfirm(proposalModal.deal, proposalModal.stage, file)}
          onCancel={() => setProposalModal(null)}
        />
      )}

      {/* Ganado */}
      {ganadoModal && (
        <GanadoModal
          deal={ganadoModal.deal}
          saving={saving}
          onConfirm={() => applyMove(ganadoModal.deal, ganadoModal.stage, null, null)}
          onCancel={() => setGanadoModal(null)}
        />
      )}

      {/* Selector de etapa móvil */}
      {mobilePicker && (
        <MobileStagePickerModal
          stages={stages}
          deal={mobilePicker}
          currentStage={mobilePicker.stage}
          onSelect={stage => { setMobilePicker(null); handleMoveRequest(mobilePicker, stage) }}
          onCancel={() => setMobilePicker(null)}
        />
      )}
    </>
  )
}
