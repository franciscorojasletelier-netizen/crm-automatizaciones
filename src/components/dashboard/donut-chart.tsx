'use client'

import { useState } from 'react'

// amount = suma de estimated_value en CLP
type Slice = { label: string; value: number; amount: number; color: string }

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

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n.toLocaleString()}`
}

// ── SVG Donut ─────────────────────────────────────────────────
function DonutChart({ slices }: { slices: Slice[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const totalDeals  = slices.reduce((s, x) => s + x.value, 0)
  const totalAmount = slices.reduce((s, x) => s + x.amount, 0)

  if (totalDeals === 0) {
    return (
      <div className="flex items-center justify-center h-44">
        <p className="text-sm text-slate-400">Sin datos</p>
      </div>
    )
  }

  const SIZE   = 168
  const STROKE = 30
  const RADIUS = (SIZE - STROKE) / 2
  const CIRC   = 2 * Math.PI * RADIUS
  const GAP    = 3

  let cumPct = 0

  return (
    <div className="flex items-center gap-6">
      {/* SVG */}
      <div className="relative flex-shrink-0">
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {slices.map((slice, i) => {
            const pct    = slice.value / totalDeals
            const dash   = Math.max(pct * CIRC - GAP, 0)
            const gap    = CIRC - dash
            const offset = cumPct * CIRC
            cumPct      += pct

            return (
              <circle
                key={i}
                cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                fill="none"
                stroke={hovered === null || hovered === i ? slice.color : slice.color + '44'}
                strokeWidth={hovered === i ? STROKE + 5 : STROKE}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ transition: 'all 0.18s ease', cursor: 'pointer' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}
        </svg>

        {/* Centro — muestra deals + $ al hover */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2">
          {hovered !== null ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-none">{slices[hovered].value}</p>
              <p className="text-[10px] font-semibold leading-tight mt-0.5"
                style={{ color: slices[hovered].color }}>
                {slices[hovered].label.length > 12
                  ? slices[hovered].label.slice(0, 11) + '…'
                  : slices[hovered].label}
              </p>
              {slices[hovered].amount > 0 && (
                <p className="text-[11px] font-bold text-emerald-600 mt-1 leading-none">
                  {fmt(slices[hovered].amount)}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900 leading-none">{totalDeals}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">deals</p>
              {totalAmount > 0 && (
                <p className="text-[11px] font-bold text-emerald-600 mt-1 leading-none">
                  {fmt(totalAmount)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Leyenda — compacta en 2 columnas */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-0.5">
          {slices.map((slice, i) => {
            const pct = totalDeals > 0 ? Math.round((slice.value / totalDeals) * 100) : 0
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
                <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums">{pct}%</span>
                {slice.amount > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 tabular-nums min-w-[44px] text-right">
                    {fmt(slice.amount)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Total row */}
        {totalAmount > 0 && (
          <div className="flex items-center gap-2 px-2 pt-2 mt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-1">Total</span>
            <span className="text-xs font-bold text-slate-700">{totalDeals} deals</span>
            <span className="text-[11px] font-bold text-emerald-700 min-w-[44px] text-right">{fmt(totalAmount)}</span>
          </div>
        )}
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
          <p className="text-[11px] text-slate-400 mt-0.5">Hover sobre gráfico o leyenda para ver detalles</p>
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
