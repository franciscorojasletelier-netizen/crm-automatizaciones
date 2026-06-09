'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, X, SlidersHorizontal } from 'lucide-react'
import DealOwnerSelector from '@/components/deals/deal-owner-selector'

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead',
  contactado: 'Contactado',
  calificado: 'Calificado',
  reunion_agendada: 'Reunión Agendada',
  reunion_realizada: 'Reunión Realizada',
  propuesta_enviada: 'Propuesta Enviada',
  negociacion: 'Negociación',
  cerrado_ganado: 'Ganado',
  cerrado_perdido: 'Perdido',
  no_calificado: 'No Calificado',
  frio: 'Frío',
}

const stageColors: Record<string, string> = {
  nuevo_lead:        'bg-blue-100   text-blue-700   ring-1 ring-blue-200',
  contactado:        'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  calificado:        'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  reunion_agendada:  'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
  reunion_realizada: 'bg-cyan-100   text-cyan-700   ring-1 ring-cyan-200',
  propuesta_enviada: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  negociacion:       'bg-pink-100   text-pink-700   ring-1 ring-pink-200',
  cerrado_ganado:    'bg-green-100  text-green-700  ring-1 ring-green-200',
  cerrado_perdido:   'bg-red-100    text-red-700    ring-1 ring-red-200',
  no_calificado:     'bg-gray-100   text-gray-600   ring-1 ring-gray-200',
  frio:              'bg-slate-100  text-slate-600  ring-1 ring-slate-200',
}

const stageDot: Record<string, string> = {
  nuevo_lead: 'bg-blue-500', contactado: 'bg-yellow-500', calificado: 'bg-purple-500',
  reunion_agendada: 'bg-indigo-500', reunion_realizada: 'bg-cyan-500',
  propuesta_enviada: 'bg-orange-500', negociacion: 'bg-pink-500',
  cerrado_ganado: 'bg-green-500', cerrado_perdido: 'bg-red-500',
  no_calificado: 'bg-gray-400', frio: 'bg-slate-400',
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

export default function LeadsTable({ deals: initialDeals, teamUsers = [], canReassign = false }: { deals: any[]; teamUsers?: any[]; canReassign?: boolean }) {
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
            {Object.entries(stageLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                <td colSpan={9} className="px-5 py-14 text-center">
                  <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No hay leads que coincidan con los filtros</p>
                </td>
              </tr>
            )}
            {paginated.map((deal: any) => (
              <tr key={deal.id} className="hover:bg-indigo-50/40 transition-colors group">
                <td className="px-5 py-3.5">
                  <Link href={`/leads/${deal.id}`} className="block">
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {deal.companies?.name ?? '—'}
                    </p>
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
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stageDot[deal.stage] ?? 'bg-gray-400'}`} />
                    {stageLabels[deal.stage] ?? deal.stage}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <ScoreBadge score={deal.score} />
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-slate-700">
                    {deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : <span className="text-slate-300">—</span>}
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
              <p className="font-bold text-slate-900">{deal.companies?.name ?? '—'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                {stageLabels[deal.stage] ?? deal.stage}
              </span>
            </div>
            <p className="text-sm text-slate-600 font-medium">{deal.contacts?.full_name ?? '—'}</p>
            {deal.contacts?.email && <p className="text-xs text-slate-400">{deal.contacts.email}</p>}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              {deal.estimated_value && <span className="font-bold text-slate-700">${Number(deal.estimated_value).toLocaleString()}</span>}
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
    </div>
  )
}
