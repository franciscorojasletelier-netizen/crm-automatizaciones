export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, CheckSquare, AlertCircle, DollarSign, Target } from 'lucide-react'
import Link from 'next/link'

async function getStats() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [dealsOpen, dealsWonMonth, tasksOverdue, leadsNew, wonValue, projects, pipeline, recentDeals, overdueTasks] = await Promise.all([
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
  ])

  const valorGanado = wonValue.data?.reduce((sum, d) => sum + (Number(d.estimated_value) || 0), 0) ?? 0

  // Contar por etapa
  const stageCounts: Record<string, number> = {}
  pipeline.data?.forEach(d => {
    stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1
  })

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

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { label: 'Deals abiertos', value: stats.dealsOpen, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', href: '/leads' },
    { label: 'Ganados este mes', value: stats.dealsWonMonth, icon: Target, color: 'text-green-600', bg: 'bg-green-50', href: '/pipeline' },
    { label: 'Proyectos activos', value: stats.proyectosActivos, icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-50', href: '/proyectos' },
    { label: 'Tareas vencidas', value: stats.tasksOverdue, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', href: '/tareas' },
  ]

  // Embudo â€” etapas en orden
  const funnelStages = ['nuevo_lead', 'contactado', 'calificado', 'reunion_agendada', 'propuesta_enviada', 'negociacion']
  const maxCount = Math.max(...funnelStages.map(s => stats.stageCounts[s] || 0), 1)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Resumen del área comercial</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </Link>
        ))}
      </div>

      {/* Valor ganado */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-green-500" />
            Valor ganado este mes
          </p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">${stats.valorGanado.toLocaleString()}</p>
        </div>
        <Link href="/pipeline" className="text-sm text-gray-400 hover:text-gray-700">Ver pipeline →</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Embudo de ventas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Embudo de ventas</h2>
          {funnelStages.every(s => !stats.stageCounts[s]) ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin datos aún</p>
          ) : (
            <div className="space-y-2">
              {funnelStages.map(stage => {
                const count = stats.stageCounts[stage] || 0
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{stageLabels[stage]}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${stageColors[stage] ?? 'bg-gray-400'}`}
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
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Tareas vencidas</h2>
            <Link href="/tareas" className="text-xs text-gray-400 hover:text-gray-700">Ver todas →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.overdueTasks.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">✅ Sin tareas vencidas</p>
            ) : stats.overdueTasks.map((task: any) => (
              <div key={task.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{task.title}</p>
                  {task.deals?.companies?.name && (
                    <p className="text-xs text-gray-400">{task.deals.companies.name}</p>
                  )}
                </div>
                <span className="text-xs text-red-500 font-medium shrink-0">
                  {new Date(task.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deals recientes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Deals activos recientes</h2>
          <Link href="/leads" className="text-xs text-gray-400 hover:text-gray-700">Ver todos →</Link>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.recentDeals.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No hay deals activos aún</p>
          )}
          {stats.recentDeals.map((deal: any) => (
            <Link key={deal.id} href={`/leads/${deal.id}`} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors block">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{deal.companies?.name ?? 'Sin empresa'}</p>
                {deal.next_action && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">→ {deal.next_action}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {deal.estimated_value && (
                  <span className="text-sm text-gray-600">${Number(deal.estimated_value).toLocaleString()}</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dealStageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {stageLabels[deal.stage] ?? deal.stage}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

