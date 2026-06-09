'use client'

import { useState } from 'react'

type Slice = { label: string; value: number; color: string }

type Filter = 'etapa' | 'fuente' | 'industria' | 'responsable'

interface Props {
  byEtapa:       Slice[]
  byFuente:      Slice[]
  byIndustria:   Slice[]
  byResponsable: Slice[]
}

const FILTER_LABELS: Record<Filter, string> = {
  etapa:       'Por etapa',
  fuente:      'Por fuente',
  industria:   'Por industria',
  responsable: 'Por responsable',
}

// ── SVG Donut ─────────────────────────────────────────────────
function DonutChart({ slices }: { slices: Slice[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-44">
        <p className="text-sm text-slate-400">Sin datos</p>
      </div>
    )
  }

  const SIZE = 160
  const STROKE = 28
  const RADIUS = (SIZE - STROKE) / 2
  const CIRC   = 2 * Math.PI * RADIUS
  const GAP    = 2 // px gap between segments

  let cumPct = 0

  return (
    <div className="flex items-center gap-6">
      {/* SVG */}
      <div className="relative flex-shrink-0">
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {slices.map((slice, i) => {
            const pct     = slice.value / total
            const dash    = Math.max(pct * CIRC - GAP, 0)
            const gap     = CIRC - dash
            const offset  = cumPct * CIRC
            cumPct       += pct

            return (
              <circle
                key={i}
                cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                fill="none"
                stroke={hovered === null || hovered === i ? slice.color : slice.color + '55'}
                strokeWidth={hovered === i ? STROKE + 4 : STROKE}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}
        </svg>
        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered !== null ? (
            <>
              <p className="text-xl font-bold text-slate-900">{slices[hovered].value}</p>
              <p className="text-[10px] text-slate-500 font-medium text-center max-w-[60px] leading-tight">
                {slices[hovered].label}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-900">{total}</p>
              <p className="text-[10px] text-slate-400 font-medium">deals</p>
            </>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex-1 space-y-1.5 min-w-0">
        {slices.map((slice, i) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer transition-colors ${hovered === i ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: slice.color }} />
              <span className="text-xs text-slate-600 font-medium flex-1 truncate">{slice.label}</span>
              <span className="text-xs font-bold text-slate-900 tabular-nums">{slice.value}</span>
              <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function DashboardDonut({ byEtapa, byFuente, byIndustria, byResponsable }: Props) {
  const [filter, setFilter] = useState<Filter>('etapa')

  const dataMap: Record<Filter, Slice[]> = {
    etapa:       byEtapa,
    fuente:      byFuente,
    industria:   byIndustria,
    responsable: byResponsable,
  }

  const current = dataMap[filter].filter(s => s.value > 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Distribución de deals</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Pasa el cursor sobre el gráfico para ver detalles</p>
        </div>
        {/* Filtros */}
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(FILTER_LABELS) as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                filter === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <DonutChart slices={current} />
    </div>
  )
}
