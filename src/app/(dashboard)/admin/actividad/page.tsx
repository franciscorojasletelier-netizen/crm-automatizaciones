export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Activity, Clock, User } from 'lucide-react'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

export default async function ActividadPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .order('full_name')

  const { data: activity } = await supabase
    .from('user_activity_log')
    .select(`
      id, action_type, entity_type, metadata, created_at,
      profiles:user_id(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(40)

  const { data: sessions } = await supabase
    .from('user_sessions')
    .select(`
      id, started_at, last_seen_at,
      profiles:user_id(full_name)
    `)
    .order('last_seen_at', { ascending: false })
    .limit(10)

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    comercial: 'Comercial',
    operaciones: 'Operaciones',
    finanzas: 'Finanzas',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Supervisión de actividad</h1>
        <p className="text-sm text-gray-500">Visibilidad total del equipo</p>
      </div>

      {/* Equipo */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">Equipo</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(!users || users.length === 0) && (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No hay usuarios registrados aún</p>
          )}
          {users?.map((user: any) => (
            <div key={user.id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {roleLabels[user.role] ?? user.role}
                </span>
                <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sesiones recientes */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">Sesiones recientes</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(!sessions || sessions.length === 0) && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin sesiones registradas</p>
            )}
            {sessions?.map((s: any) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <p className="text-sm text-gray-700">{s.profiles?.full_name ?? '—'}</p>
                <p className="text-xs text-gray-400">{timeAgo(s.last_seen_at)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feed de actividad */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">Feed de actividad</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(!activity || activity.length === 0) && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin actividad registrada</p>
            )}
            {activity?.map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{a.profiles?.full_name ?? 'Sistema'}</span>
                    {' · '}
                    <span className="text-gray-500">{a.action_type}</span>
                    {a.entity_type && (
                      <span className="text-gray-400"> en {a.entity_type}</span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{timeAgo(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
