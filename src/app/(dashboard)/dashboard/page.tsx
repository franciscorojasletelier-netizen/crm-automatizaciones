export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, CheckSquare, AlertCircle, DollarSign, Target, ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'
import DashboardDonut from '@/components/dashboard/donut-chart'

async function getStats() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [dealsOpen, dealsWonMonth, tasksOverdue, leadsNew, wonValue, projects, pipeline, recentDeals, overdueTasks, allDealsForChart] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact' }).eq('status', 'open'),
    supabase.from('deals').select('id', { count: 'exact' }).eq('status', 'won').gte('updated_at', startOfMonth),
    supabase.from('tasks').select('id', { count: 'exact' }).eq('is_completed', false).lt('due_date', now.toISOString()),
    supabase.from('deals').select('id', { count: 'exact' }).eq('stage', 'nuevo_lead'),
    supabase.from('deals').select('estimated_value').eq('status', 'won').gte('updated_at', startOfMonth),
    supabase.from('projects').select('id', { count: 'exact' }).eq('status', 'activo'),
    supabase.from('deals').select('stage').eq('status', 'open'),
    supabase.from('deals').select(`
      id, stage, estimated_value, next_action, updated_at,
      companies(name), profiles(full_name)
    `).eq('status', 'open').order('updated_at', { ascending: false }).limit(6),
    supabase.from('tasks').select(`
      id, title, due_date,
      deals(companies(name))
    `).eq('is_completed', false).lt('due_date', now.toISOString()).order('due_date', { ascending: true }).limit(5),
    // Para gráfico donut
    supabase.from('deals').select(`stage, source, estimated_value, profiles:owner_id(full_name), companies(industry)`),
  ])

  const valorGanado = wonValue.data?.reduce((sum, d) => sum + (Number(d.estimated_value) || 0), 0) ?? 0

  const stageCounts: Record<string, number> = {}
  pipeline.data?.forEach(d => {
    stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1
  })

  // Chart data
  const chartDeals = allDealsForChart.data ?? []

  // Por etapa
  const STAGE_COLORS: Record<string, string> = {
    nuevo_lead: '#3b82f6', contactado: '#eab308', calificado: '#a855f7',
    reunion_agendada: '#6366f1', reunion_realizada: '#06b6d4',
    propuesta_enviada: '#f97316', negociacion: '#ec4899',
    cerrado_ganado: '#22c55e', cerrado_perdido: '#ef4444',
    no_calificado: '#9ca3af', frio: '#64748b',
  }
  const STAGE_LABELS: Record<string, string> = {
    nuevo_lead: 'Nuevo Lead', contactado: 'Contactado', calificado: 'Calificado',
    reunion_agendada: 'Reunión Agendada', reunion_realizada: 'Reunión Realizada',
    propuesta_enviada: 'Propuesta Enviada', negociacion: 'Negociación',
    cerrado_ganado: 'Ganado', cerrado_perdido: 'Perdido',
    no_calificado: 'No Calificado', frio: 'Frío',
  }
  // Helper: agrupar por clave y sumar count + amount
  function groupBy(key: (d: any) => string, colorList: string[]) {
    const map: Record<string, { count: number; amount: number }> = {}
    chartDeals.forEach((d: any) => {
      const k = key(d) || 'Sin datos'
      if (!map[k]) map[k] = { count: 0, amount: 0 }
      map[k].count++
      map[k].amount += Number(d.estimated_value) || 0
    })
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([k, v], i) => ({
        label: k, value: v.count, amount: v.amount,
        color: colorList[i % colorList.length],
      }))
  }

  const FUENTE_COLORS = ['#6366f1','#f97316','#22c55e','#eab308','#ec4899','#06b6d4','#a855f7','#94a3b8']

  // Por etapa (con colores propios)
  const stageMap: Record<string, { count: number; amount: number }> = {}
  chartDeals.forEach((d: any) => {
    if (!stageMap[d.stage]) stageMap[d.stage] = { count: 0, amount: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].amount += Number(d.estimated_value) || 0
  })
  const byEtapa = Object.entries(stageMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([k, v]) => ({
      label: STAGE_LABELS[k] ?? k, value: v.count, amount: v.amount,
      color: STAGE_COLORS[k] ?? '#94a3b8',
    }))

  const byFuente      = groupBy(d => d.source,                         FUENTE_COLORS)
  const byIndustria   = groupBy(d => d.companies?.industry,            FUENTE_COLORS)
  const byResponsable = groupBy(d => d.profiles?.full_name,            FUENTE_COLORS)

  return {
    dealsOpen: dealsOpen.count ?? 0,
    dealsWonMonth: dealsWonMonth.count ?? 0,
    tasksOverdue: tasksOverdue.count ?? 0,
    leadsNew: leadsNew.count ?? 0,
    valorGanado,
    proyectosActivos: projects.count ?? 0,
    stageCounts,
    recentDeals: recentDeals.data ?? [],
    overdueTasks: overdueTasks.data ?? [],
    byEtapa, byFuente, byIndustria, byResponsable,
  }
}

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead',
  contactado: 'Contactado',
  calificado: 'Calificado',
  reunion_agendada: 'Reunión Agendada',
  propuesta_enviada: 'Propuesta Enviada',
  negociacion: 'Negociación',
  cerrado_ganado: 'Ganado',
}

const stageColors: Record<string, string> = {
  nuevo_lead: 'bg-blue-500',
  contactado: 'bg-yellow-500',
  calificado: 'bg-purple-500',
  reunion_agendada: 'bg-indigo-500',
  propuesta_enviada: 'bg-orange-500',
  negociacion: 'bg-pink-500',
  cerrado_ganado: 'bg-green-500',
}

const dealStageColors: Record<string, string> = {
  nuevo_lead: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  contactado: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  calificado: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  reunion_agendada: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
  reunion_realizada: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200',
  propuesta_enviada: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  negociacion: 'bg-pink-100 text-pink-700 ring-1 ring-pink-200',
  cerrado_ganado: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cerrado_perdido: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  no_calificado: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  frio: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    {
      label: 'Deals abiertos',
      value: stats.dealsOpen,
      icon: TrendingUp,
      href: '/leads',
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      border: 'border-blue-100',
    },
    {
      label: 'Ganados este mes',
      value: stats.dealsWonMonth,
      icon: Target,
      href: '/pipeline',
      gradient: 'from-emerald-500 to-green-600',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    {
      label: 'Proyectos activos',
      value: stats.proyectosActivos,
      icon: CheckSquare,
      href: '/proyectos',
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      border: 'border-violet-100',
    },
    {
      label: 'Tareas vencidas',
      value: stats.tasksOverdue,
      icon: AlertCircle,
      href: '/tareas',
      gradient: 'from-red-500 to-rose-600',
      bg: 'bg-red-50',
      iconColor: 'text-red-600',
      border: 'border-red-100',
      alert: stats.tasksOverdue > 0,
    },
  ]

  const funnelStages = ['nuevo_lead', 'contactado', 'calificado', 'reunion_agendada', 'propuesta_enviada', 'negociacion']
  const maxCount = Math.max(...funnelStages.map(s => stats.stageCounts[s] || 0), 1)

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Resumen del área comercial</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map(({ label, value, icon: Icon, gradient, bg, iconColor, border, href, alert }) => (
          <Link key={label} href={href}
            className={`group relative bg-white rounded-2xl border ${border} p-4 md:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden`}>
            {/* Barra superior de color */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />

            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              {alert && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>

            <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>

            <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Ver detalle</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>

      {/* Valor ganado — destacado */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 md:p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-400/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Valor ganado este mes</p>
            </div>
            <p className="text-4xl font-bold text-white tracking-tight">
              ${stats.valorGanado.toLocaleString()}
            </p>
          </div>
          <Link href="/pipeline"
            className="hidden md:flex items-center gap-2 text-sm text-indigo-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl">
            Ver pipeline <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Gráfico Donut */}
      <DashboardDonut
        byEtapa={stats.byEtapa}
        byFuente={stats.byFuente}
        byIndustria={stats.byIndustria}
        byResponsable={stats.byResponsable}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

        {/* Embudo de ventas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-900">Embudo de ventas</h2>
            <Link href="/pipeline" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Ver Pipeline <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {funnelStages.every(s => !stats.stageCounts[s]) ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">Sin datos aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {funnelStages.map(stage => {
                const count = stats.stageCounts[stage] || 0
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-medium">{stageLabels[stage]}</span>
                      <span className="font-bold text-slate-900 tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${stageColors[stage] ?? 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tareas vencidas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Tareas vencidas</h2>
              {stats.overdueTasks.length > 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {stats.overdueTasks.length}
                </span>
              )}
            </div>
            <Link href="/tareas" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.overdueTasks.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Sin tareas vencidas</p>
              </div>
            ) : stats.overdueTasks.map((task: any) => (
              <div key={task.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                  {task.deals?.companies?.name && (
                    <p className="text-xs text-slate-400 mt-0.5">{task.deals.companies.name}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-semibold bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100">
                  {new Date(task.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deals recientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Deals activos recientes</h2>
          </div>
          <Link href="/leads" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.recentDeals.length === 0 && (
            <div className="px-5 py-10 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No hay deals activos aún</p>
            </div>
          )}
          {stats.recentDeals.map((deal: any) => (
            <Link key={deal.id} href={`/leads/${deal.id}`}
              className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                  {deal.companies?.name ?? 'Sin empresa'}
                </p>
                {deal.next_action && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">→ {deal.next_action}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {deal.estimated_value && (
                  <span className="text-sm font-semibold text-slate-700">
                    ${Number(deal.estimated_value).toLocaleString()}
                  </span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${dealStageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {stageLabels[deal.stage] ?? deal.stage}
                </span>
                <span className="text-xs text-slate-300 hidden lg:block">{timeAgo(deal.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
