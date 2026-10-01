'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCLP } from '@/lib/format'
import { X, Check, Flame, PenLine, Paperclip, Trophy } from 'lucide-react'
import { StageIcon } from '@/lib/stage-icons'
import { type Stage, stageByKey, colorOf, boardStages, terminalStages } from '@/lib/stages'
import { changeDealStage, uploadProposal } from '@/lib/deal-stage-change'
import { ReasonModal, ProposalModal, WonModal } from '@/components/deals/stage-change-modals'
import { useDialog } from '@/lib/use-dialog'

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

// ── Modal selector de etapa (móvil) ──────────────────────────
function MobileStagePickerModal({ deal, currentStage, stages, onSelect, onCancel }: {
  deal: KanbanDeal; currentStage: string; stages: Stage[]; onSelect: (stage: string) => void; onCancel: () => void
}) {
  const dialogRef = useDialog(true, onCancel)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mover deal de etapa" className="relative w-full max-w-lg bg-white rounded-t-lg shadow-2xl overflow-hidden outline-none">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          <p className="text-xs font-medium text-slate-500 mb-0.5">Mover deal</p>
          <p className="text-sm font-bold text-slate-900 truncate">{deal.companies?.name ?? 'Deal'}</p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pb-8"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {stages.map(s => {
            const isCurrent = s.key === currentStage
            const c = colorOf(s)
            return (
              <button key={s.key} onClick={() => !isCurrent && onSelect(s.key)} disabled={isCurrent}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-all text-left ${
                  isCurrent
                    ? `${c.light} ${c.text} border-current opacity-60 cursor-default`
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 active:scale-95'
                }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
                <span className="leading-tight">{s.label}</span>
                {s.isTerminal && !isCurrent && <span className="ml-auto text-[11px] text-slate-400">cierre</span>}
                {isCurrent && <Check className="ml-auto w-3.5 h-3.5" />}
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
      'background:var(--color-slate-900)',
      'color:white', 'padding:8px 14px', 'border-radius:12px',
      'font-size:13px', 'font-weight:700', 'white-space:nowrap',
      'box-shadow:0 8px 24px rgba(15,23,42,0.25)',
      'pointer-events:none', 'z-index:9999',
    ].join(';')
    ghost.textContent = deal.companies?.name ?? 'Deal'
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

  // Sube la propuesta y recién entonces mueve: si falla la subida, el deal no se mueve.
  async function handleProposalConfirm(deal: KanbanDeal, targetStage: string, file: File) {
    setSaving(true)
    setError('')
    try {
      const extraUpdates = await uploadProposal(supabase, { organizationId, dealId: deal.id, file })
      await applyMove(deal, targetStage, null, null, extraUpdates)
    } catch (err) {
      setError(`Error subiendo propuesta: ${err instanceof Error ? err.message : 'desconocido'} — el deal no se movió`)
      setSaving(false)
      setProposalModal(null)
    }
  }

  // La lógica del cambio (status, proyecto al ganar, avisos, automatizaciones)
  // vive en src/lib/deal-stage-change.ts, compartida con el detalle del lead.
  async function applyMove(deal: KanbanDeal, targetStage: string, reason: string | null, comment: string | null, extraUpdates?: Record<string, unknown>) {
    setSaving(true)
    setError('')

    // Optimistic update
    const prevStage = deal.stage
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d))

    const result = await changeDealStage(supabase, {
      dealId: deal.id, fromStage: prevStage, toStage: targetStage, stages, reason, comment, extraUpdates,
    })

    if (!result.ok) {
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: prevStage } : d))
      setError('Error al actualizar: ' + result.error)
    } else if (result.warning) {
      setError(result.warning)
    }

    setSaving(false)
    setReasonModal(null); setProposalModal(null); setGanadoModal(null)
    if (result.ok) router.refresh()
  }

  return (
    <>
      {error && (
        <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-lg">
          <X className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Barra de herramientas: instrucción + estancados + toggle de vista */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-xs text-slate-400 font-medium flex-1 min-w-[200px]">
          {view === 'board'
            ? <><span className="md:hidden">Toca <span className="font-bold text-slate-500">Mover</span> en una tarjeta para cambiarla de etapa o cerrarla.</span><span className="hidden md:inline">Arrastra las tarjetas entre columnas. Para cerrar un deal, suéltalo en la <span className="font-bold text-slate-500">bandeja de cierre</span> que aparece abajo.</span></>
            : <>Vista de lista — los mismos deals del tablero, ordenados por valor.</>
          }
        </p>

        {stalledCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">
            <Flame className="w-3.5 h-3.5" /> {stalledCount} estancado{stalledCount > 1 ? 's' : ''} (7d+ sin contacto)
          </span>
        )}

        {/* Toggle Tablero / Lista (patrón HubSpot) */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {([['board', 'Tablero'], ['list', 'Lista']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                view === key ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista LISTA (patrón HubSpot: tabla sincronizada con el tablero) ── */}
      {view === 'list' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex-1">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Empresa', 'Etapa', 'Valor', 'Score', 'Responsable', 'Próxima acción', 'Últ. contacto', ''].map(h => (
                  <th key={h} className="text-xs font-medium text-slate-500 text-left px-4 py-3">{h}</th>
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
                  <tr key={deal.id} className="hover:bg-accent-50/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{deal.companies?.name ?? 'Sin empresa'}</span>
                        {stalled && <Flame className="w-3 h-3 text-red-500" aria-label="Estancado" />}
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
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-accent-100 flex items-center justify-center text-slate-400 hover:text-accent-600 transition-colors">
                        <span className="text-[11px] font-bold">→</span>
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
                <span className="text-xs font-medium text-slate-500 flex-1 truncate">
                  {stage.label}
                  {needsReason && <PenLine className="inline ml-1 w-3 h-3 text-amber-600" aria-label="Requiere justificación" />}
                  {isProposal  && <Paperclip className="inline ml-1 w-3 h-3 text-orange-600" aria-label="Requiere propuesta adjunta" />}
                  {isGanado    && <Trophy className="inline ml-1 w-3 h-3 text-emerald-600" aria-label="Etapa de ganado" />}
                </span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${c.light} ${c.text}`}>
                  {stageDeals.length}
                </span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => onDragOver(e, stage.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, stage.key)}
                className={`flex flex-col gap-2 min-h-[100px] rounded-lg p-1.5 transition-all duration-150 ${
                  isOver
                    ? `ring-2 ${c.ring} bg-white shadow-lg scale-[1.01]`
                    : 'ring-1 ring-transparent'
                }`}
              >
                {stageDeals.length === 0 ? (
                  <div className={`border-2 border-dashed rounded-lg h-20 flex items-center justify-center transition-colors ${
                    isOver ? `${c.light} border-current ${c.text}` : 'border-slate-200 bg-white/50'
                  }`}>
                    <p className={`text-xs font-medium ${isOver ? c.text : 'text-slate-300'}`}>
                      {isOver ? 'Soltar aquí' : 'Sin deals'}
                    </p>
                  </div>
                ) : (
                  stageDeals.map(deal => {
                    const stalled = isStalled(deal)
                    const score = deal.score ?? 0
                    return (
                    <div
                      key={deal.id}
                      draggable={!readOnly}
                      onDragStart={e => onDragStart(e, deal)}
                      onDragEnd={onDragEnd}
                      className={`rounded-md p-3 cursor-grab active:cursor-grabbing transition-colors group ${
                        draggingId === deal.id
                          ? 'border border-dashed border-slate-400 bg-slate-50'
                          : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/leads/${deal.id}`} onClick={e => e.stopPropagation()} draggable={false}
                          className="min-w-0 text-[13px] font-semibold leading-snug text-slate-900 hover:text-accent-700 hover:underline truncate">
                          {deal.companies?.name ?? 'Sin empresa'}
                        </Link>
                        {stalled && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-medium text-red-700" title={`${staleDays(deal)} días sin contacto`}>
                            <Flame className="w-3 h-3" />{staleDays(deal)}d
                          </span>
                        )}
                      </div>
                      {deal.contacts?.full_name && (
                        <p className="text-xs text-slate-500 truncate">{deal.contacts.full_name}</p>
                      )}
                      {deal.estimated_value ? (
                        <p className="mt-2 text-[13px] font-medium tabular-nums text-slate-900">{formatCLP(deal.estimated_value)}</p>
                      ) : null}
                      {deal.next_action && (
                        <p className="mt-1 text-xs text-slate-500 leading-snug line-clamp-2">{deal.next_action}</p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
                        <span className={`text-[11px] font-medium tabular-nums ${score >= 60 ? 'text-emerald-700' : score >= 30 ? 'text-amber-700' : 'text-slate-500'}`}
                          title="Score del lead">
                          Score {score}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {deal.profiles?.full_name && (
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center"
                              title={deal.profiles.full_name} aria-label={`Responsable: ${deal.profiles.full_name}`}>
                              {deal.profiles.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {/* Mover — solo en celular, donde no se puede arrastrar */}
                          <button
                            onClick={e => { e.stopPropagation(); e.preventDefault(); setMobilePicker(deal) }}
                            className="md:hidden h-9 px-3 rounded-md border border-slate-300 bg-white text-[13px] font-medium text-slate-800 active:bg-slate-100"
                            aria-label={`Mover ${deal.companies?.name ?? 'deal'} de etapa`}
                          >
                            Mover
                          </button>
                        </div>
                      </div>
                    </div>
                    )
                  })
                )}

                {/* Indicador "soltar aquí" cuando hay deals */}
                {isOver && stageDeals.length > 0 && (
                  <div className={`border-2 border-dashed rounded-lg h-12 flex items-center justify-center ${c.light} border-current ${c.text}`}>
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
                  className={`flex flex-col items-center justify-center gap-0.5 h-16 rounded-lg border-2 border-dashed font-bold text-xs tracking-wider transition-all duration-150 ${
                    isOver
                      ? `${c.solid} text-white scale-105 border-transparent`
                      : `${c.light} ${c.text} border-current/40`
                  }`}
                >
                  <StageIcon stage={zone} className="w-5 h-5" />
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
            className="text-xs font-medium text-slate-500 flex items-center gap-2 hover:text-slate-700 transition-colors"
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
                    className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${
                      draggingId === deal.id
                        ? 'border-dashed border-accent-300 bg-accent-50/50 opacity-60'
                        : `bg-white border-slate-200 hover:border-slate-300`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`} />
                    <span className="text-xs font-bold text-slate-700">{deal.companies?.name ?? 'Deal'}</span>
                    {deal.estimated_value && (
                      <span className="text-[11px] font-semibold text-slate-400">
                        {formatCLP(deal.estimated_value)}
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${c.light} ${c.text}`}>{st?.label ?? deal.stage}</span>
                    <Link
                      href={`/leads/${deal.id}`}
                      onClick={e => e.stopPropagation()}
                      className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-accent-100 hover:text-accent-600 transition-colors"
                    >
                      <span className="text-[11px] font-bold">→</span>
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
          busy={saving}
          onConfirm={(reason, comment) => applyMove(reasonModal.deal, reasonModal.stage, reason, comment)}
          onCancel={() => setReasonModal(null)}
        />
      )}

      {/* Adjunto obligatorio (etapas con requires_attachment) */}
      {proposalModal && (
        <ProposalModal
          stageLabel={stageByKey(stages, proposalModal.stage)?.label ?? proposalModal.stage}
          companyName={proposalModal.deal.companies?.name ?? 'Deal'}
          busy={saving}
          onConfirm={file => handleProposalConfirm(proposalModal.deal, proposalModal.stage, file)}
          onCancel={() => setProposalModal(null)}
        />
      )}

      {/* Ganado */}
      {ganadoModal && (
        <WonModal
          companyName={ganadoModal.deal.companies?.name}
          value={ganadoModal.deal.estimated_value}
          createsProject={!!stageByKey(stages, ganadoModal.stage)?.createsProject}
          busy={saving}
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
