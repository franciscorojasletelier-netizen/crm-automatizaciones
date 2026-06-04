'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, X } from 'lucide-react'

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
  nuevo_lead: 'bg-blue-100 text-blue-700',
  contactado: 'bg-yellow-100 text-yellow-700',
  calificado: 'bg-purple-100 text-purple-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_realizada: 'bg-cyan-100 text-cyan-700',
  propuesta_enviada: 'bg-orange-100 text-orange-700',
  negociacion: 'bg-pink-100 text-pink-700',
  cerrado_ganado: 'bg-green-100 text-green-700',
  cerrado_perdido: 'bg-red-100 text-red-700',
  no_calificado: 'bg-gray-100 text-gray-600',
  frio: 'bg-slate-100 text-slate-600',
}

export default function LeadsTable({ deals }: { deals: any[] }) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const sources = useMemo(() => {
    const s = new Set(deals.map(d => d.source).filter(Boolean))
    return Array.from(s) as string[]
  }, [deals])

  const filtered = useMemo(() => {
    return deals.filter(deal => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        deal.companies?.name?.toLowerCase().includes(q) ||
        deal.contacts?.full_name?.toLowerCase().includes(q) ||
        deal.contacts?.email?.toLowerCase().includes(q) ||
        deal.next_action?.toLowerCase().includes(q)
      const matchStage = !stageFilter || deal.stage === stageFilter
      const matchSource = !sourceFilter || deal.source === sourceFilter
      return matchSearch && matchStage && matchSource
    })
  }, [deals, search, stageFilter, sourceFilter])

  const hasFilters = search || stageFilter || sourceFilter

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empresa, contacto, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
        </div>

        {/* Filtro etapa */}
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700"
        >
          <option value="">Todas las etapas</option>
          {Object.entries(stageLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Filtro fuente */}
        {sources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700"
          >
            <option value="">Todas las fuentes</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Limpiar filtros */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setStageFilter(''); setSourceFilter('') }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}

        <p className="text-sm text-gray-400 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabla — desktop */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Etapa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Valor est.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fuente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Próxima acción</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No hay leads que coincidan con los filtros
                </td>
              </tr>
            )}
            {filtered.map((deal: any) => (
              <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/leads/${deal.id}`} className="block hover:underline">
                    <p className="font-medium text-gray-900">{deal.companies?.name ?? '—'}</p>
                    {deal.companies?.industry && (
                      <p className="text-xs text-gray-400">{deal.companies.industry}</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{deal.contacts?.full_name ?? '—'}</p>
                  {deal.contacts?.email && (
                    <p className="text-xs text-gray-400">{deal.contacts.email}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                    {stageLabels[deal.stage] ?? deal.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${deal.score >= 60 ? 'text-green-600' : deal.score >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {deal.score}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{deal.source ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{deal.next_action ?? '—'}</td>
                <td className="px-4 py-3 text-gray-300">
                  <Link href={`/leads/${deal.id}`}>
                    <ChevronRight className="w-4 h-4 hover:text-gray-600" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No hay leads que coincidan</p>
        )}
        {filtered.map((deal: any) => (
          <Link key={deal.id} href={`/leads/${deal.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-medium text-gray-900">{deal.companies?.name ?? '—'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                {stageLabels[deal.stage] ?? deal.stage}
              </span>
            </div>
            <p className="text-sm text-gray-600">{deal.contacts?.full_name ?? '—'}</p>
            {deal.contacts?.email && <p className="text-xs text-gray-400">{deal.contacts.email}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {deal.estimated_value && <span className="font-medium text-gray-700">${Number(deal.estimated_value).toLocaleString()}</span>}
              {deal.source && <span>{deal.source}</span>}
              {deal.next_action && <span className="truncate">→ {deal.next_action}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
