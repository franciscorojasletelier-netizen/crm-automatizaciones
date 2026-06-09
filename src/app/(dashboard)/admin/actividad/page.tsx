export const dynamic = 'force-dynamic'
import { createClient, requirePermission } from '@/lib/supabase/server'
import { Activity, Clock, User, Shield, Wifi, ClipboardList, ChevronRight } from 'lucide-react'
import Link from 'next/link'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

const roleConfig: Record<string, { label: string; color: string }> = {
  admin:       { label: 'Admin',       color: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  comercial:   { label: 'Comercial',   color: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  operaciones: { label: 'Operaciones', color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  finanzas:    { label: 'Finanzas',    color: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function ActividadPage() {
  const supabase = await createClient()

  await requirePermission('actividad')
  const [{ data: users }, { data: activity }, { data: sessions }, { data: taskHistory }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, is_active').order('full_name'),
    supabase.from('user_activity_log').select('id, action_type, entity_type, metadata, created_at, profiles:user_id(full_name, email)').order('created_at', { ascending: false }).limit(40),
    supabase.from('user_sessions').select('id, started_at, last_seen_at, profiles:user_id(full_name)').order('last_seen_at', { ascending: false }).limit(10),
    supabase.from('task_history').select(`
      id, field_changed, old_value, new_value, comment, created_at,
      changer:changed_by(full_name),
      task:task_id(title, deals(companies(name)))
    `).order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Actividad</h1>
        <p className="text-sm text-slate-500 mt-0.5">Supervisión del equipo en tiempo real</p>
      </div>

      {/* Equipo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Equipo</h2>
          {users && <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-1">{users.length}</span>}
        </div>
        <div className="divide-y divide-slate-50">
          {(!users || users.length === 0) && (
            <p className="px-5 py-8 text-sm text-slate-400 text-center font-medium">No hay usuarios registrados</p>
          )}
          {users?.map((user: any) => (
            <div key={user.id} className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-slate-50/50 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {getInitials(user.full_name ?? 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleConfig[user.role]?.color ?? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
                  {roleConfig[user.role]?.label ?? user.role}
                </span>
                <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} title={user.is_active ? 'Activo' : 'Inactivo'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historial de cambios en tareas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <ClipboardList className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 flex-1">Cambios en tareas</h2>
          {taskHistory && taskHistory.length > 0 && (
            <span className="text-xs font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{taskHistory.length}</span>
          )}
        </div>
        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
          {(!taskHistory || taskHistory.length === 0) ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center font-medium">Sin cambios registrados aún</p>
          ) : (taskHistory as any[]).map((h) => {
            const task = h.task as any
            const formatVal = (v: string | null) => {
              if (!v) return 'Sin fecha'
              const d = new Date(v)
              if (isNaN(d.getTime())) return v
              return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            }
            return (
              <div key={h.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Quién + qué tarea */}
                    <p className="text-sm text-slate-800 leading-snug">
                      <span className="font-bold text-slate-900">{(h.changer as any)?.full_name ?? 'Usuario'}</span>
                      <span className="text-slate-400 mx-1.5">reprogramó</span>
                      <span className="font-semibold text-indigo-700">{task?.title ?? 'tarea'}</span>
                      {task?.deals?.companies?.name && (
                        <span className="text-slate-400 ml-1">· {task.deals.companies.name}</span>
                      )}
                    </p>
                    {/* Valor anterior → nuevo */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded line-through">
                        {formatVal(h.old_value)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                        {formatVal(h.new_value)}
                      </span>
                    </div>
                    {/* Comentario */}
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-1.5 leading-relaxed">
                      💬 {h.comment}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                    {timeAgo(h.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sesiones recientes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Sesiones recientes</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(!sessions || sessions.length === 0) && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center font-medium">Sin sesiones registradas</p>
            )}
            {sessions?.map((s: any) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">{s.profiles?.full_name ?? '—'}</p>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{timeAgo(s.last_seen_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feed de actividad */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Feed de actividad</h2>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {(!activity || activity.length === 0) && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center font-medium">Sin actividad registrada</p>
            )}
            {activity?.map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">
                    <span className="font-semibold text-slate-900">{a.profiles?.full_name ?? 'Sistema'}</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-500">{a.action_type}</span>
                    {a.entity_type && <span className="text-slate-400"> en {a.entity_type}</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
