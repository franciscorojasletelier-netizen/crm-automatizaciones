export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import { BarChart3, TrendingUp, Target, DollarSign, Award, ArrowRight, Users, Download } from 'lucide-react'
import Link from 'next/link'
import { formatCLP } from '@/lib/format'

const stageLabels: Record<string, string> = {
  nuevo_lead:        'Nuevo Lead',
  contactado:        'Contactado',
  calificado:        'Calificado',
  reunion_agendada:  'Reunión Agendada',
  reunion_realizada: 'Reunión Realizada',
  propuesta_enviada: 'Propuesta Enviada',
  negociacion:       'Negociación',
  cerrado_ganado:    'Cerrado Ganado',
  cerrado_perdido:   'Cerrado Perdido',
  no_calificado:     'No Calificado',
  frio:              'Frío',
}

async function getReportData(supabase: any) {
  const now = new Date()

  // Últimos 6 meses
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
      start: d.toISOString(),
      end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    }
  })

  const [
    allDeals,
    wonDeals,
    lostDeals,
    activeDeals,
    stageAll,
    executivesRaw,
    recentWon,
  ] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id, estimated_value, updated_at').eq('status', 'won'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'lost'),
    supabase.from('deals').select('estimated_value, probability, stage').eq('status', 'open'),
    supabase.from('deals').select('stage, status'),
    // Leaderboard: ejecutivos con sus deals
    supabase.from('profiles')
      .select('id, full_name, email')
      .in('role', ['comercial', 'gerente', 'super_admin', 'admin'])
      .eq('is_active', true),
    supabase.from('deals')
      .select('id, estimated_value, updated_at, stage, companies(name), profiles:owner_id(full_name)')
      .eq('status', 'won')
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  // Revenue por mes
  const monthlyRevenue = await Promise.all(
    months.map(async (m) => {
      const { data } = await supabase
        .from('deals')
        .select('estimated_value')
        .eq('status', 'won')
        .gte('updated_at', m.start)
        .lte('updated_at', m.end)
      const revenue = data?.reduce((sum: number, d: any) => sum + (Number(d.estimated_value) || 0), 0) ?? 0
      return { label: m.label, revenue }
    })
  )

  // Performance por ejecutivo
  const execPerformance = await Promise.all(
    (executivesRaw.data ?? []).map(async (exec: any) => {
      const [won, lost, open] = await Promise.all([
        supabase.from('deals').select('estimated_value').eq('owner_id', exec.id).eq('status', 'won'),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('owner_id', exec.id).eq('status', 'lost'),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('owner_id', exec.id).eq('status', 'open'),
      ])
      const revenue = won.data?.reduce((s: number, d: any) => s + (Number(d.estimated_value) || 0), 0) ?? 0
      const wonCount = won.data?.length ?? 0
      const lostCount = lost.count ?? 0
      const openCount = open.count ?? 0
      const total = wonCount + lostCount
      const winRate = total > 0 ? Math.round((wonCount / total) * 100) : 0
      return { ...exec, revenue, wonCount, lostCount, openCount, winRate }
    })
  )

  // Ordenar leaderboard por revenue
  execPerformance.sort((a, b) => b.revenue - a.revenue)

  // Embudo de conversión
  const stageCounts: Record<string, number> = {}
  ;(stageAll.data ?? []).forEach((d: any) => {
    if (!stageCounts[d.stage]) stageCounts[d.stage] = 0
    stageCounts[d.stage]++
  })

  const totalDeals = allDeals.count ?? 0
  const totalWon = wonDeals.data?.length ?? 0
  const totalLost = lostDeals.count ?? 0
  const totalRevenue = wonDeals.data?.reduce((s: number, d: any) => s + (Number(d.estimated_value) || 0), 0) ?? 0
  const avgDealSize = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0
  const winRate = (totalWon + totalLost) > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0

  // Forecast ponderado: Σ(valor × probabilidad) de deals abiertos.
  // Si el deal no tiene probabilidad asignada, se usa una por etapa (estándar CRM).
  const STAGE_PROBABILITY: Record<string, number> = {
    nuevo_lead: 10, contactado: 20, calificado: 30,
    reunion_agendada: 40, reunion_realizada: 50,
    propuesta_enviada: 60, negociacion: 80,
  }
  const openDealsData = activeDeals.data ?? []
  const forecast = Math.round(openDealsData.reduce((sum: number, d: any) => {
    const prob = (d.probability && d.probability > 0) ? d.probability : (STAGE_PROBABILITY[d.stage] ?? 10)
    return sum + (Number(d.estimated_value) || 0) * (prob / 100)
  }, 0))
  const openCount = openDealsData.length

  return {
    totalDeals, totalWon, totalLost, totalRevenue, avgDealSize, winRate,
    forecast, openCount,
    monthlyRevenue, execPerformance, stageCounts, recentWon: recentWon.data ?? [],
  }
}

export default async function ReportesPage() {
  const { supabase } = await requirePermission('reportes')
  const data = await getReportData(supabase)

  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1)

  const funnelStages = [
    'nuevo_lead', 'contactado', 'calificado',
    'reunion_agendada', 'propuesta_enviada', 'negociacion',
  ]
  const funnelColors = [
    'from-blue-500 to-blue-600',
    'from-yellow-500 to-amber-500',
    'from-purple-500 to-purple-600',
    'from-indigo-500 to-indigo-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-rose-500',
  ]
  const maxFunnel = Math.max(...funnelStages.map(s => data.stageCounts[s] || 0), 1)

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
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
            label: 'Revenue total',
            value: formatCLP(data.totalRevenue),
            sub: 'Deals cerrados ganados',
            icon: DollarSign,
            color: 'text-emerald-600 bg-emerald-50',
            border: 'border-emerald-100',
            bar: 'from-emerald-500 to-green-600',
          },
          {
            label: 'Win Rate',
            value: `${data.winRate}%`,
            sub: `${data.totalWon} ganados / ${data.totalLost} perdidos`,
            icon: Target,
            color: 'text-indigo-600 bg-indigo-50',
            border: 'border-indigo-100',
            bar: 'from-indigo-500 to-purple-600',
          },
          {
            label: 'Valor promedio',
            value: formatCLP(data.avgDealSize),
            sub: 'Por deal ganado',
            icon: TrendingUp,
            color: 'text-amber-600 bg-amber-50',
            border: 'border-amber-100',
            bar: 'from-amber-500 to-orange-500',
          },
          {
            label: 'Forecast ponderado',
            value: formatCLP(data.forecast),
            sub: `${data.openCount} deals abiertos × probabilidad`,
            icon: Award,
            color: 'text-violet-600 bg-violet-50',
            border: 'border-violet-100',
            bar: 'from-violet-500 to-purple-600',
          },
        ].map(({ label, value, sub, icon: Icon, color, border, bar }) => (
          <div key={label} className={`bg-white rounded-2xl border ${border} p-4 md:p-5 shadow-sm relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${bar}`} />
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue mensual */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Revenue mensual</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Últimos 6 meses (deals ganados)</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-40">
            {data.monthlyRevenue.map((m) => {
              const pct = maxRevenue > 0 ? Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 4 : 0) : 0
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-500 leading-none">
                    {m.revenue > 0 ? `$${Math.round(m.revenue / 1000).toLocaleString('es-CL')} mil` : ''}
                  </p>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      style={{
                        height: `${pct}%`,
                        minHeight: m.revenue > 0 ? '4px' : '0',
                        background: m.revenue > 0
                          ? 'linear-gradient(to top, #6366f1, #8b5cf6)'
                          : '#f1f5f9',
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">{m.label}</p>
                </div>
              )
            })}
          </div>
          {data.monthlyRevenue.every(m => m.revenue === 0) && (
            <p className="text-center text-sm text-slate-400 py-4">Sin revenue registrado aún</p>
          )}
        </div>

        {/* Embudo de conversión */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Embudo de conversión</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribución por etapa</p>
            </div>
            <Link href="/pipeline" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Pipeline <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {funnelStages.map((stage, i) => {
              const count = data.stageCounts[stage] || 0
              const pct = Math.round((count / maxFunnel) * 100)
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">{stageLabels[stage]}</span>
                    <span className="font-bold text-slate-900 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${funnelColors[i]} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {/* Ganados */}
            <div className="pt-2 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-emerald-700 font-semibold">✓ Cerrado Ganado</span>
                <span className="font-bold text-emerald-700 tabular-nums">{data.totalWon}</span>
              </div>
              <div className="h-2 bg-emerald-50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-700"
                  style={{ width: `${Math.round((data.totalWon / maxFunnel) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard ejecutivos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">#</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Ejecutivo</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Revenue</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Ganados</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Perdidos</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">En curso</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Win Rate</th>
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
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <tr key={exec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-400 text-center w-12">
                      {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-xs">{i + 1}</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                          {initials}
                        </div>
                        <span className="font-semibold text-slate-800">{exec.full_name ?? exec.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-bold text-emerald-700">
                      {exec.revenue > 0 ? formatCLP(exec.revenue) : '—'}
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
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Últimos deals ganados</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recentWon.map((deal: any) => (
              <Link key={deal.id} href={`/leads/${deal.id}`}
                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {deal.companies?.name ?? 'Sin empresa'}
                  </p>
                  {deal.profiles?.full_name && (
                    <p className="text-xs text-slate-400 mt-0.5">{deal.profiles.full_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {deal.estimated_value && (
                    <span className="text-sm font-bold text-emerald-700">
                      {formatCLP(deal.estimated_value)}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(deal.updated_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
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
