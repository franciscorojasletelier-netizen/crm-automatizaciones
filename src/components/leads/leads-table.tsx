'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, Search, X, SlidersHorizontal, Users, Loader2, CheckSquare } from 'lucide-react'
import DealOwnerSelector from '@/components/deals/deal-owner-selector'
import { formatCLP } from '@/lib/format'
import { type Stage, stageByKey, colorOf } from '@/lib/stages'

// Días desde el último contacto (o desde la creación si nunca se contactó)
function daysSinceContact(deal: any): number {
  const ref = deal.last_contacted_at ?? deal.created_at
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
}

function StaleBadge({ deal, stages }: { deal: any; stages: Stage[] }) {
  // Antes era un array CLOSED hardcodeado con las 4 etapas terminales.
  // No tiene nada que ver con ganado/perdido: un deal cerrado o congelado
  // simplemente no acumula "días sin contacto".
  if (stageByKey(stages, deal.stage)?.isTerminal) return null
  const days = daysSinceContact(deal)
  if (days < 3) return null
  const isUrgent = days >= 7
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
      isUrgent ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
    }`} title={deal.last_contacted_at ? 'Días desde el último contacto' : 'Días desde la creación, sin contacto registrado'}>
      {isUrgent ? '🔥' : '⏳'} {days}d sin contacto
    </span>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  const s = score ?? 0
  const color = s >= 60 ? 'text-emerald-700 bg-emerald-50 ring-emerald-200'
              : s >= 30 ? 'text-yellow-700 bg-yellow-50 ring-yellow-200'
              : 'text-slate-500 bg-slate-100 ring-slate-200'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${color}`}>
      {s}
    </span>
  )
}

export default function LeadsTable({ deals: initialDeals, teamUsers = [], canReassign = false, stages = [] }: { deals: any[]; teamUsers?: any[]; canReassign?: boolean; stages?: Stage[] }) {
  const [deals, setDeals]   = useState(initialDeals)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  // Cuando el server rerenderiza, sincronizar
  useEffect(() => { setDeals(initialDeals) }, [initialDeals])

  function handleReassigned(dealId: string, newOwner: any) {
    setDeals(prev => prev.map(d =>
      d.id === dealId
        ? { ...d, profiles: { id: newOwner.id, full_name: newOwner.full_name } }
        : d
    ))
  }

  // ── Selección múltiple y acciones masivas ──────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const router = useRouter()

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function bulkReassign(targetUserId: string) {
    if (selected.size === 0 || bulkSaving) return
    setBulkSaving(true)
    const supabase = createClient()
    const ids = [...selected]
    const { error } = await supabase.from('deals').update({ owner_id: targetUserId }).in('id', ids)
    if (!error) {
      const target = teamUsers.find(u => u.id === targetUserId)
      // Notificar al nuevo responsable (una sola notificación resumida)
      const { data: { user: me } } = await supabase.auth.getUser()
      if (me && targetUserId !== me.id) {
        await supabase.from('notifications').insert({
          user_id:     targetUserId,
          type:        'deal_assigned',
          title:       `📋 Te asignaron ${ids.length} lead${ids.length > 1 ? 's' : ''}`,
          body:        `Reasignación masiva — revisa tu lista de leads`,
          entity_type: 'deal',
          entity_id:   ids[0],
        })
      }
      setDeals(prev => prev.map(d =>
        selected.has(d.id)
          ? { ...d, profiles: target ? { id: target.id, full_name: target.full_name } : d.profiles }
          : d
      ))
      setSelected(new Set())
      router.refresh()
    }
    setBulkSaving(false)
  }

  const sources = useMemo(() => Array.from(new Set(deals.map(d => d.source).filter(Boolean))) as string[], [deals])

  const filtered = useMemo(() => deals.filter(deal => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      deal.companies?.name?.toLowerCase().includes(q) ||
      deal.contacts?.full_name?.toLowerCase().includes(q) ||
      deal.contacts?.email?.toLowerCase().includes(q) ||
      deal.next_action?.toLowerCase().includes(q)
    return matchSearch &&
      (!stageFilter || deal.stage === stageFilter) &&
      (!sourceFilter || deal.source === sourceFilter)
  }), [deals, search, stageFilter, sourceFilter])

  const hasFilters = search || stageFilter || sourceFilter
  const PAGE_SIZE = 25
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search, stageFilter, sourceFilter])

  return (
    <div className="space-y-4">

      {/* Barra de filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar empresa, contacto, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
          >
            <option value="">Todas las etapas</option>
            {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          {sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
            >
              <option value="">Todas las fuentes</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStageFilter(''); setSourceFilter('') }}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>

        <span className="text-xs font-semibold text-slate-400 ml-auto bg-slate-100 px-2.5 py-1 rounded-lg">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla — desktop */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {canReassign && (
                <th className="pl-4 pr-0 py-3.5 w-8">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && paginated.every((d: any) => selected.has(d.id))}
                    onChange={e => {
                      setSelected(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) paginated.forEach((d: any) => next.add(d.id))
                        else paginated.forEach((d: any) => next.delete(d.id))
                        return next
                      })
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                  />
                </th>
              )}
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Etapa</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor est.</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fuente</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Responsable</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Próxima acción</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canReassign ? 10 : 9} className="px-5 py-14 text-center">
                  <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No hay leads que coincidan con los filtros</p>
                </td>
              </tr>
            )}
            {paginated.map((deal: any) => (
              <tr key={deal.id} className={`transition-colors group ${selected.has(deal.id) ? 'bg-indigo-50/60' : 'hover:bg-indigo-50/40'}`}>
                {canReassign && (
                  <td className="pl-4 pr-0 py-3.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(deal.id)}
                      onChange={() => toggleSelect(deal.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                    />
                  </td>
                )}
                <td className="px-5 py-3.5">
                  <Link href={`/leads/${deal.id}`} className="block">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {deal.companies?.name ?? '—'}
                      </p>
                      <StaleBadge deal={deal} stages={stages} />
                    </div>
                    {deal.companies?.industry && (
                      <p className="text-xs text-slate-400 mt-0.5">{deal.companies.industry}</p>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-slate-700 font-medium">{deal.contacts?.full_name ?? '—'}</p>
                  {deal.contacts?.email && (
                    <p className="text-xs text-slate-400 mt-0.5">{deal.contacts.email}</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${colorOf(stageByKey(stages, deal.stage)).chip}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colorOf(stageByKey(stages, deal.stage)).dot}`} />
                    {stageByKey(stages, deal.stage)?.label ?? deal.stage}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <ScoreBadge score={deal.score} />
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-slate-700">
                    {deal.estimated_value ? formatCLP(deal.estimated_value) : <span className="text-slate-300">—</span>}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {deal.source
                    ? <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{deal.source}</span>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-3 py-2.5 min-w-[160px]" onClick={e => e.stopPropagation()}>
                  <DealOwnerSelector
                    dealId={deal.id}
                    currentOwner={deal.profiles ? { id: deal.profiles.id, full_name: deal.profiles.full_name } : null}
                    teamUsers={teamUsers}
                    canReassign={canReassign}
                    onReassigned={handleReassigned}
                  />
                </td>
                <td className="px-5 py-3.5 text-slate-500 max-w-[180px] truncate text-xs">
                  {deal.next_action ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/leads/${deal.id}`}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-100 flex items-center justify-center transition-colors group-hover:bg-indigo-100">
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No hay leads que coincidan</p>
          </div>
        )}
        {paginated.map((deal: any) => (
          <Link key={deal.id} href={`/leads/${deal.id}`}
            className="flex flex-col bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-bold text-slate-900">{deal.companies?.name ?? '—'}</p>
                <StaleBadge deal={deal} stages={stages} />
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${colorOf(stageByKey(stages, deal.stage)).chip}`}>
                {stageByKey(stages, deal.stage)?.label ?? deal.stage}
              </span>
            </div>
            <p className="text-sm text-slate-600 font-medium">{deal.contacts?.full_name ?? '—'}</p>
            {deal.contacts?.email && <p className="text-xs text-slate-400">{deal.contacts.email}</p>}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              {deal.estimated_value && <span className="font-bold text-slate-700">{formatCLP(deal.estimated_value)}</span>}
              {deal.source && <span className="bg-slate-100 px-2 py-0.5 rounded-md">{deal.source}</span>}
              <ScoreBadge score={deal.score} />
            </div>
          </Link>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-sm">
          <span className="text-sm text-slate-500">
            <span className="font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> de <span className="font-semibold">{filtered.length}</span>
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Anterior
            </button>
            <span className="px-3.5 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ── Barra flotante de acciones masivas ── */}
      {canReassign && selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl pl-4 sm:pl-5 pr-3 py-3 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Reasignar a:</span>
              <select
                disabled={bulkSaving}
                defaultValue=""
                onChange={e => { if (e.target.value) bulkReassign(e.target.value) }}
                className="bg-slate-800 text-white text-sm font-semibold rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="" disabled>Elegir...</option>
                {teamUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                ))}
              </select>
              {bulkSaving && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            </div>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Cancelar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
