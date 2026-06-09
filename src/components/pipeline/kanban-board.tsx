'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { runAutomationsForStageChange } from '@/lib/automations'
import {
  X, AlertTriangle, XCircle, MinusCircle, PauseCircle,
  MessageSquare, Loader2, CheckCircle2, Paperclip,
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────
export type KanbanDeal = {
  id: string
  stage: string
  score: number | null
  estimated_value: number | null
  next_action: string | null
  companies: { name: string } | null
  contacts: { full_name: string } | null
  profiles: { full_name: string } | null
}

// ── Etapas ────────────────────────────────────────────────────
const ALL_STAGES = [
  { key: 'nuevo_lead',        label: 'Nuevo Lead',        color: 'bg-blue-500',   light: 'bg-blue-50',    text: 'text-blue-700',   ring: 'ring-blue-300'   },
  { key: 'contactado',        label: 'Contactado',         color: 'bg-yellow-500', light: 'bg-yellow-50',  text: 'text-yellow-700', ring: 'ring-yellow-300' },
  { key: 'calificado',        label: 'Calificado',         color: 'bg-purple-500', light: 'bg-purple-50',  text: 'text-purple-700', ring: 'ring-purple-300' },
  { key: 'reunion_agendada',  label: 'Reunión Agendada',   color: 'bg-indigo-500', light: 'bg-indigo-50',  text: 'text-indigo-700', ring: 'ring-indigo-300' },
  { key: 'reunion_realizada', label: 'Reunión Realizada',  color: 'bg-cyan-500',   light: 'bg-cyan-50',    text: 'text-cyan-700',   ring: 'ring-cyan-300'   },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada',  color: 'bg-orange-500', light: 'bg-orange-50',  text: 'text-orange-700', ring: 'ring-orange-300' },
  { key: 'negociacion',       label: 'Negociación',        color: 'bg-pink-500',   light: 'bg-pink-50',    text: 'text-pink-700',   ring: 'ring-pink-300'   },
  { key: 'cerrado_ganado',    label: 'Ganado ✓',           color: 'bg-green-500',  light: 'bg-green-50',   text: 'text-green-700',  ring: 'ring-green-300'  },
  { key: 'cerrado_perdido',   label: 'Perdido',            color: 'bg-red-500',    light: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-300'    },
  { key: 'no_calificado',     label: 'No Calificado',      color: 'bg-gray-400',   light: 'bg-gray-50',    text: 'text-gray-700',   ring: 'ring-gray-300'   },
  { key: 'frio',              label: 'Frío ❄️',             color: 'bg-slate-400',  light: 'bg-slate-100',  text: 'text-slate-600',  ring: 'ring-slate-300'  },
]

const REASON_REQUIRED = ['cerrado_perdido', 'no_calificado', 'frio']
const CLOSED_STAGES   = ['cerrado_ganado', 'cerrado_perdido', 'no_calificado']

// Config para modales de etapas negativas
const MODAL_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string; bg: string; border: string; btnColor: string
  title: string; subtitle: string; confirmLabel: string
  reasons: string[]
}> = {
  cerrado_perdido: {
    icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', btnColor: 'from-red-500 to-red-600',
    title: '¿Por qué se perdió este deal?',
    subtitle: 'Esta información ayuda al gerente a mejorar la estrategia comercial.',
    confirmLabel: 'Confirmar pérdida',
    reasons: ['Precio muy alto','Eligió a la competencia','Sin presupuesto disponible','Sin urgencia o prioridad','Contacto no es el decisor','Proyecto cancelado por cliente','Propuesta no convenció','Otro'],
  },
  no_calificado: {
    icon: MinusCircle, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', btnColor: 'from-gray-500 to-gray-600',
    title: '¿Por qué no está calificado?',
    subtitle: 'Explica al gerente por qué este lead no cumple los criterios.',
    confirmLabel: 'Marcar como no calificado',
    reasons: ['No tiene presupuesto','No es el mercado objetivo','Ya tiene una solución similar','Empresa demasiado pequeña','Sin autoridad de compra','Sector no compatible','Otro'],
  },
  frio: {
    icon: PauseCircle, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', btnColor: 'from-slate-500 to-slate-600',
    title: '¿Por qué se congela este deal?',
    subtitle: 'Indica al gerente la razón y si vale la pena retomarlo.',
    confirmLabel: 'Congelar deal',
    reasons: ['Cliente pidió pausar','Esperando decisión interna','Presupuesto bloqueado temporalmente','Reorganización en la empresa del cliente','Sin respuesta por más de 30 días','Otro'],
  },
}

// ── Modal razón ───────────────────────────────────────────────
function ReasonModal({
  targetStage, onConfirm, onCancel, saving,
}: { targetStage: string; onConfirm: (r: string, c: string) => void; onCancel: () => void; saving: boolean }) {
  const cfg = MODAL_CONFIG[targetStage]
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const Icon = cfg.icon
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
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 bg-gradient-to-r ${cfg.btnColor}`}>
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

// ── Modal para Propuesta Enviada (sin subir archivo desde kanban) ──
function ProposalWarningModal({ deal, onConfirm, onCancel, saving }: {
  deal: KanbanDeal; onConfirm: () => void; onCancel: () => void; saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
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
        </div>
        <div className="p-6">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Recuerda <strong>adjuntar el documento de propuesta</strong> desde el detalle del deal. Se puede hacer en cualquier momento.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onConfirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Moviendo...</> : <><CheckCircle2 className="w-4 h-4" /> Confirmar movimiento</>}
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
            <p className="text-lg font-bold text-green-700 mt-2">${Number(deal.estimated_value).toLocaleString()}</p>
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

// ── Componente principal ───────────────────────────────────────
export default function KanbanBoard({ initialDeals }: { initialDeals: KanbanDeal[] }) {
  const [deals, setDeals] = useState<KanbanDeal[]>(initialDeals)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // Modales pendientes
  const [reasonModal,   setReasonModal]   = useState<{ deal: KanbanDeal; stage: string } | null>(null)
  const [proposalModal, setProposalModal] = useState<{ deal: KanbanDeal } | null>(null)
  const [ganadoModal,   setGanadoModal]   = useState<{ deal: KanbanDeal } | null>(null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Agrupar por etapa
  const byStage: Record<string, KanbanDeal[]> = {}
  for (const s of ALL_STAGES) {
    byStage[s.key] = deals.filter(d => d.stage === s.key)
  }

  // ── Drag handlers ──────────────────────────────────────────
  function onDragStart(e: React.DragEvent, deal: KanbanDeal) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dealId', deal.id)
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
    const dealId = e.dataTransfer.getData('dealId') || draggingId
    if (!dealId) return
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return

    // Según la etapa, mostrar modal correspondiente
    if (targetStage === 'cerrado_ganado') {
      setGanadoModal({ deal })
      return
    }
    if (REASON_REQUIRED.includes(targetStage)) {
      setReasonModal({ deal, stage: targetStage })
      return
    }
    if (targetStage === 'propuesta_enviada') {
      setProposalModal({ deal })
      return
    }
    // Etapa normal: aplicar directamente
    applyMove(deal, targetStage, null, null)
  }

  // ── Apply move ─────────────────────────────────────────────
  async function applyMove(deal: KanbanDeal, targetStage: string, reason: string | null, comment: string | null) {
    setSaving(true)
    setError('')

    // Optimistic update
    const prevStage = deal.stage
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d))

    const updates: Record<string, any> = { stage: targetStage }
    if (CLOSED_STAGES.includes(targetStage)) {
      updates.status = targetStage === 'cerrado_ganado' ? 'won' : 'lost'
    }
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

    // Auto-crear proyecto si ganado
    if (targetStage === 'cerrado_ganado' && updatedDeal) {
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

    // Notificar gerentes si etapa negativa
    if (REASON_REQUIRED.includes(targetStage) && reason) {
      const { data: gerentes } = await supabase
        .from('profiles').select('id')
        .in('role', ['gerente', 'super_admin', 'admin']).eq('is_active', true)
      if (gerentes?.length) {
        const stageLabel = ALL_STAGES.find(s => s.key === targetStage)?.label ?? targetStage
        const companyName = (updatedDeal as any)?.companies?.name ?? 'deal'
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

    // Ejecutar automatizaciones en segundo plano (no bloquea UI)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    runAutomationsForStageChange({
      supabase,
      dealId:  deal.id,
      toStage: targetStage,
      status:  updates.status as 'won' | 'lost' | 'open' | undefined,
      ownerId: (updatedDeal as any)?.owner_id ?? undefined,
      userId:  currentUser?.id ?? '',
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

      {/* Instrucción */}
      <p className="text-xs text-slate-400 mb-3 font-medium">
        💡 Arrastra las tarjetas entre columnas para cambiar etapa. Las etapas marcadas con <span className="text-amber-600 font-bold">✏️</span> requieren justificación.
      </p>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start select-none">
        {ALL_STAGES.map(stage => {
          const stageDeals = byStage[stage.key] ?? []
          const isOver = dragOverStage === stage.key
          const needsReason = REASON_REQUIRED.includes(stage.key)
          const isProposal = stage.key === 'propuesta_enviada'
          const isGanado   = stage.key === 'cerrado_ganado'

          return (
            <div key={stage.key} className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0">

              {/* Column header */}
              <div className="flex items-center gap-1.5 mb-2.5 px-1">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color} shadow-sm flex-shrink-0`} />
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex-1 truncate">
                  {stage.label}
                  {needsReason && <span className="ml-1 text-amber-500" title="Requiere justificación">✏️</span>}
                  {isProposal  && <span className="ml-1 text-orange-400" title="Requiere propuesta adjunta">📎</span>}
                  {isGanado    && <span className="ml-1">🏆</span>}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.light} ${stage.text}`}>
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
                    ? `ring-2 ${stage.ring} bg-white shadow-lg scale-[1.01]`
                    : 'ring-1 ring-transparent'
                }`}
              >
                {stageDeals.length === 0 ? (
                  <div className={`border-2 border-dashed rounded-xl h-20 flex items-center justify-center transition-colors ${
                    isOver ? `${stage.light} border-current ${stage.text}` : 'border-slate-200 bg-white/50'
                  }`}>
                    <p className={`text-xs font-medium ${isOver ? stage.text : 'text-slate-300'}`}>
                      {isOver ? 'Soltar aquí' : 'Sin deals'}
                    </p>
                  </div>
                ) : (
                  stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={e => onDragStart(e, deal)}
                      onDragEnd={onDragEnd}
                      className={`bg-white border border-slate-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all duration-150 relative overflow-hidden group ${
                        draggingId === deal.id ? 'opacity-40 scale-95 shadow-none' : ''
                      }`}
                    >
                      {/* Barra color top */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${stage.color}`} />

                      {/* Empresa */}
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate group-hover:text-indigo-700 transition-colors">
                        {deal.companies?.name ?? 'Sin empresa'}
                      </p>

                      {/* Contacto */}
                      {deal.contacts?.full_name && (
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium truncate">{deal.contacts.full_name}</p>
                      )}

                      {/* Valor */}
                      {deal.estimated_value && (
                        <p className="text-sm font-bold text-slate-700 mt-2">
                          ${Number(deal.estimated_value).toLocaleString()}
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
                  <div className={`border-2 border-dashed rounded-xl h-12 flex items-center justify-center ${stage.light} border-current ${stage.text}`}>
                    <p className="text-xs font-semibold">Soltar aquí</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modales ─────────────────────────────────────────── */}

      {/* Razón (Perdido / No Calificado / Frío) */}
      {reasonModal && (
        <ReasonModal
          targetStage={reasonModal.stage}
          saving={saving}
          onConfirm={(reason, comment) => applyMove(reasonModal.deal, reasonModal.stage, reason, comment)}
          onCancel={() => setReasonModal(null)}
        />
      )}

      {/* Propuesta enviada */}
      {proposalModal && (
        <ProposalWarningModal
          deal={proposalModal.deal}
          saving={saving}
          onConfirm={() => applyMove(proposalModal.deal, 'propuesta_enviada', null, null)}
          onCancel={() => setProposalModal(null)}
        />
      )}

      {/* Ganado */}
      {ganadoModal && (
        <GanadoModal
          deal={ganadoModal.deal}
          saving={saving}
          onConfirm={() => applyMove(ganadoModal.deal, 'cerrado_ganado', null, null)}
          onCancel={() => setGanadoModal(null)}
        />
      )}
    </>
  )
}
