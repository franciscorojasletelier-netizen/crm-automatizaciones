export const dynamic = 'force-dynamic'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePermission } from '@/lib/supabase/server'
import { BarChart3, TrendingUp, Target, DollarSign, Award, ArrowRight, Users, Download } from 'lucide-react'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import { type Stage, getStages, colorOf, funnelStages as funnelOf, probabilityForStage } from '@/lib/stages'
import { CHILE_TZ, chileMonthStart } from '@/lib/dates'

type ReportDeal = {
  id: string; status: 'open' | 'won' | 'lost'; stage: string; owner_id: string | null
  estimated_value: number | null; probability: number | null; closed_at: string | null
}

async function getReportData(supabase: SupabaseClient, stages: Stage[]) {
  // Últimos 6 meses calendario de Chile. Antes se armaban con la hora del
  // servidor (UTC) y se filtraba por updated_at: editar un deal ganado hace
  // meses lo movía al mes actual. Ahora cuenta la fecha real de cierre.
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = chileMonthStart(i - 5)
    return {
      label: start.toLocaleDateString('es-CL', { timeZone: CHILE_TZ, month: 'short', year: '2-digit' }),
      start: start.getTime(),
      end: chileMonthStart(i - 4).getTime(),
    }
  })

  // Tres consultas en total. Antes eran 6 por los meses + 3 por cada
  // ejecutivo (N+1): con 10 ejecutivos, 40 idas a la base por carga.
  const [dealsRes, executivesRaw, recentWon] = await Promise.all([
    supabase.from('deals')
      .select('id, status, stage, owner_id, estimated_value, probability, closed_at')
      .limit(20000),
    supabase.from('profiles')
      .select('id, full_name, email')
      .in('role', ['comercial', 'gerente', 'super_admin', 'admin'])
      .eq('is_active', true),
    supabase.from('deals')
      .select('id, estimated_value, closed_at, stage, companies(name), profiles:owner_id(full_name)')
      .eq('status', 'won')
      .order('closed_at', { ascending: false, nullsFirst: false })
      .limit(5),
  ])

  const deals: ReportDeal[] = dealsRes.data ?? []
  const value = (d: ReportDeal) => Number(d.estimated_value) || 0
  const won  = deals.filter(d => d.status === 'won')
  const lost = deals.filter(d => d.status === 'lost')
  const open = deals.filter(d => d.status === 'open')

  const monthlyRevenue = months.map(m => ({
    label: m.label,
    revenue: won.reduce((sum, d) => {
      const t = d.closed_at ? Date.parse(d.closed_at) : NaN
      return t >= m.start && t < m.end ? sum + value(d) : sum
    }, 0),
  }))

  type ExecRow = { id: string; full_name: string | null; email: string | null; revenue: number; wonCount: number; lostCount: number; openCount: number; winRate: number }
  const execPerformance: ExecRow[] = (executivesRaw.data ?? []).map((exec: { id: string; full_name: string | null; email: string | null }) => {
    const mine = (list: ReportDeal[]) => list.filter(d => d.owner_id === exec.id)
    const wonMine = mine(won)
    const wonCount = wonMine.length
    const lostCount = mine(lost).length
    const total = wonCount + lostCount
    return {
      ...exec,
      revenue: wonMine.reduce((s, d) => s + value(d), 0),
      wonCount, lostCount,
      openCount: mine(open).length,
      winRate: total > 0 ? Math.round((wonCount / total) * 100) : 0,
    }
  })
  execPerformance.sort((a, b) => b.revenue - a.revenue)

  const stageCounts: Record<string, number> = {}
  for (const d of deals) stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1

  const totalRevenue = won.reduce((s, d) => s + value(d), 0)
  const totalWon = won.length
  const totalLost = lost.length

  // Forecast ponderado: Σ(valor × probabilidad) de deals abiertos. Sin
  // probabilidad propia se usa la de su etapa (configurable por organización).
  const forecast = Math.round(open.reduce((sum, d) =>
    sum + value(d) * (probabilityForStage(stages, d.stage, d.probability) / 100), 0))

  return {
    totalDeals: deals.length, totalWon, totalLost, totalRevenue,
    avgDealSize: totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0,
    winRate: (totalWon + totalLost) > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0,
    forecast, openCount: open.length,
    monthlyRevenue, execPerformance, stageCounts,
    // Relaciones a-uno: sin tipos de base se infieren como arreglo.
    recentWon: (recentWon.data ?? []) as unknown as {
      id: string; estimated_value: number | null; closed_at: string | null; stage: string
      companies: { name: string | null } | null; profiles: { full_name: string | null } | null
    }[],
  }
}

export default async function ReportesPage() {
  const { supabase, organizationId, currency } = await requirePermission('reportes')
  const stages = await getStages(supabase, organizationId ?? undefined)
  const data = await getReportData(supabase, stages)

  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1)

  // Antes el color venía de un array posicional acoplado al orden del
  // embudo; ahora cada etapa trae el suyo.
  const funnelStages = funnelOf(stages)
  const maxFunnel = Math.max(...funnelStages.map(s => data.stageCounts[s.key] || 0), 1)

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-7 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900">Reportes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Análisis de rendimiento comercial</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <BarChart3 className="w-3.5 h-3.5" />
            Datos en tiempo real
          </div>
          <a
            href="/api/reports/export"
            download
            className="bg-emerald-600 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-xs hover:-translate-y-0.5 transition-all"

          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Ingresos cerrados',
            value: formatMoney(data.totalRevenue, currency),
            sub: 'Deals cerrados ganados',
            icon: DollarSign,
            color: 'text-emerald-600 bg-emerald-50',
            border: 'border-emerald-100',
          },
          {
            label: 'Tasa de cierre',
            value: `${data.winRate}%`,
            sub: `${data.totalWon} ganados / ${data.totalLost} perdidos`,
            icon: Target,
            color: 'text-accent-600 bg-accent-50',
            border: 'border-accent-100',
          },
          {
            label: 'Valor promedio',
            value: formatMoney(data.avgDealSize, currency),
            sub: 'Por deal ganado',
            icon: TrendingUp,
            color: 'text-amber-600 bg-amber-50',
            border: 'border-amber-100',
          },
          {
            label: 'Forecast ponderado',
            value: formatMoney(data.forecast, currency),
            sub: `${data.openCount} deals abiertos × probabilidad`,
            icon: Award,
            color: 'text-accent-600 bg-accent-50',
            border: 'border-accent-100',
          },
        ].map(({ label, value, sub, icon: Icon, color, border }) => (
          <div key={label} className={`bg-white rounded-lg border ${border} p-4 md:p-5 shadow-sm relative overflow-hidden`}>
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue mensual */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Ingresos por mes</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Últimos 6 meses (deals ganados)</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-40">
            {data.monthlyRevenue.map((m) => {
              const pct = maxRevenue > 0 ? Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 4 : 0) : 0
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-[11px] font-bold text-slate-500 leading-none">
                    {m.revenue > 0 ? `$${Math.round(m.revenue / 1000).toLocaleString('es-CL')} mil` : ''}
                  </p>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      style={{
                        height: `${pct}%`,
                        minHeight: m.revenue > 0 ? '4px' : '0',
                        background: m.revenue > 0
                          ? 'var(--color-accent-600)'
                          : '#f1f5f9',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">{m.label}</p>
                </div>
              )
            })}
          </div>
          {data.monthlyRevenue.every(m => m.revenue === 0) && (
            <p className="text-center text-sm text-slate-400 py-4">Sin ingresos cerrados aún</p>
          )}
        </div>

        {/* Embudo de conversión */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Embudo de conversión</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribución por etapa</p>
            </div>
            <Link href="/pipeline" className="text-xs text-accent-600 hover:text-accent-800 font-medium flex items-center gap-1">
              Pipeline <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {funnelStages.map(stage => {
              const count = data.stageCounts[stage.key] || 0
              const pct = Math.round((count / maxFunnel) * 100)
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">{stage.label}</span>
                    <span className="font-bold text-slate-900 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorOf(stage).solid} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {/* Ganados */}
            <div className="pt-2 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-emerald-700 font-semibold">Cerrado ganado</span>
                <span className="font-bold text-emerald-700 tabular-nums">{data.totalWon}</span>
              </div>
              <div className="h-2 bg-emerald-50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-700"
                  style={{ width: `${Math.round((data.totalWon / maxFunnel) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard ejecutivos */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Award className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Leaderboard de ejecutivos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-xs font-medium text-slate-500 px-5 py-3 text-left">#</th>
                <th className="text-xs font-medium text-slate-500 px-3 py-3 text-left">Ejecutivo</th>
                <th className="text-xs font-medium text-slate-500 px-3 py-3 text-right">Ingresos</th>
                <th className="text-xs font-medium text-slate-500 px-3 py-3 text-right">Ganados</th>
                <th className="text-xs font-medium text-slate-500 px-3 py-3 text-right">Perdidos</th>
                <th className="text-xs font-medium text-slate-500 px-3 py-3 text-right">En curso</th>
                <th className="text-xs font-medium text-slate-500 px-5 py-3 text-right">Tasa de cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.execPerformance.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    Sin datos de ejecutivos
                  </td>
                </tr>
              )}
              {data.execPerformance.map((exec, i) => {
                const initials = (exec.full_name ?? exec.email ?? 'U')
                  .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
                return (
                  <tr key={exec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-400 text-center w-12">
                      <span className={`text-xs tabular-nums ${i === 0 ? 'text-slate-900' : 'text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="bg-accent-600 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                           >
                          {initials}
                        </div>
                        <span className="font-semibold text-slate-800">{exec.full_name ?? exec.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-bold text-emerald-700">
                      {exec.revenue > 0 ? formatMoney(exec.revenue, currency) : '—'}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {exec.wonCount}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {exec.lostCount > 0 ? (
                        <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          {exec.lostCount}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {exec.openCount > 0 ? (
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {exec.openCount}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-600"
                            style={{ width: `${exec.winRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{exec.winRate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimos deals ganados */}
      {data.recentWon.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Últimos deals ganados</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recentWon.map(deal => (
              <Link key={deal.id} href={`/leads/${deal.id}`}
                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-accent-700 transition-colors">
                    {deal.companies?.name ?? 'Sin empresa'}
                  </p>
                  {deal.profiles?.full_name && (
                    <p className="text-xs text-slate-400 mt-0.5">{deal.profiles.full_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {deal.estimated_value && (
                    <span className="text-sm font-bold text-emerald-700">
                      {formatMoney(deal.estimated_value, currency)}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {deal.closed_at ? new Date(deal.closed_at).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short' }) : '—'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
