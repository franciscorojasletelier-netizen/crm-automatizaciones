import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, CheckSquare, AlertCircle } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()

  const [dealsOpen, dealsWon, tasksOverdue, leadsNew] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact' }).eq('status', 'open'),
    supabase.from('deals').select('id', { count: 'exact' }).eq('status', 'won'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact' })
      .eq('is_completed', false)
      .lt('due_date', new Date().toISOString()),
    supabase.from('deals').select('id', { count: 'exact' }).eq('stage', 'nuevo_lead'),
  ])

  return {
    dealsOpen: dealsOpen.count ?? 0,
    dealsWon: dealsWon.count ?? 0,
    tasksOverdue: tasksOverdue.count ?? 0,
    leadsNew: leadsNew.count ?? 0,
  }
}

async function getRecentDeals() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select(`
      id, stage, estimated_value, next_action, updated_at,
      companies(name),
      profiles(full_name)
    `)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(8)
  return data ?? []
}

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

export default async function DashboardPage() {
  const [stats, recentDeals] = await Promise.all([getStats(), getRecentDeals()])

  const cards = [
    { label: 'Deals abiertos', value: stats.dealsOpen, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Deals ganados', value: stats.dealsWon, icon: Users, color: 'text-green-600' },
    { label: 'Nuevos leads', value: stats.leadsNew, icon: Users, color: 'text-purple-600' },
    { label: 'Tareas vencidas', value: stats.tasksOverdue, icon: AlertCircle, color: 'text-red-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Resumen del área comercial</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Deals recientes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Deals activos recientes</h2>
          <a href="/pipeline" className="text-xs text-gray-500 hover:text-gray-900">Ver pipeline →</a>
        </div>
        <div className="divide-y divide-gray-100">
          {recentDeals.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No hay deals activos aún</p>
          )}
          {recentDeals.map((deal: any) => (
            <div key={deal.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {deal.companies?.name ?? 'Sin empresa'}
                </p>
                {deal.next_action && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">→ {deal.next_action}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {deal.estimated_value && (
                  <span className="text-sm text-gray-600">
                    ${Number(deal.estimated_value).toLocaleString()}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {stageLabels[deal.stage] ?? deal.stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
