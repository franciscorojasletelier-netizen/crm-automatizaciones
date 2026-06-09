export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import NotificationsList from '@/components/notifications/notifications-list'

export default async function NotificacionesPage() {
  const { user, supabase } = await getCurrentProfile()

  const now   = new Date()
  const today = now.toISOString().split('T')[0]  // "2026-06-09"
  const todayEnd = today + 'T23:59:59'

  // ── AUTO-NOTIFICAR tareas vencidas y de hoy (queries en paralelo) ──
  const [{ data: overdueTasks }, { data: todayTasks }, { data: todayNotifs }] = await Promise.all([
    supabase
      .from('tasks')
      .select(`id, title, due_date, deals(companies(name))`)
      .eq('assigned_to', user.id)
      .eq('is_completed', false)
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true })
      .limit(20),
    supabase
      .from('tasks')
      .select(`id, title, due_date, deals(companies(name))`)
      .eq('assigned_to', user.id)
      .eq('is_completed', false)
      .gte('due_date', today)
      .lte('due_date', todayEnd)
      .limit(10),
    // Notificaciones ya emitidas hoy — una sola query en vez de una por tarea
    supabase
      .from('notifications')
      .select('entity_id, type')
      .eq('user_id', user.id)
      .in('type', ['task_overdue', 'task_due'])
      .gte('created_at', today),
  ])

  const alreadyNotified = new Set(
    (todayNotifs ?? []).map(n => `${n.type}:${n.entity_id}`)
  )

  const newNotifs: any[] = []

  for (const task of overdueTasks ?? []) {
    if (alreadyNotified.has(`task_overdue:${task.id}`)) continue
    const company = (task.deals as any)?.companies?.name
    const dueStr  = new Date(task.due_date!).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
    newNotifs.push({
      user_id:     user.id,
      type:        'task_overdue',
      title:       `⏰ Tarea vencida: ${task.title}`,
      body:        `Venció el ${dueStr}${company ? ` · ${company}` : ''}`,
      entity_type: 'task',
      entity_id:   task.id,
    })
  }

  for (const task of todayTasks ?? []) {
    if (alreadyNotified.has(`task_due:${task.id}`)) continue
    // Una tarea vencida hoy no debe generar ambas notificaciones
    if (alreadyNotified.has(`task_overdue:${task.id}`)) continue
    if (newNotifs.some(n => n.entity_id === task.id)) continue
    const company = (task.deals as any)?.companies?.name
    const dueStr  = task.due_date
      ? new Date(task.due_date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : null
    newNotifs.push({
      user_id:     user.id,
      type:        'task_due',
      title:       `📋 Tarea para hoy: ${task.title}`,
      body:        `${dueStr ? `A las ${dueStr}` : 'Hoy'}${company ? ` · ${company}` : ''}`,
      entity_type: 'task',
      entity_id:   task.id,
    })
  }

  // Un solo insert masivo en vez de uno por tarea
  if (newNotifs.length > 0) {
    await supabase.from('notifications').insert(newNotifs)
  }

  // ── Leer todas las notificaciones del usuario ──────────────
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const unreadCount = (notifications ?? []).filter(n => !n.is_read).length

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl font-semibold">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount} nuevas
          </div>
        )}
      </div>

      {/* Info: qué genera notificaciones */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">¿Cuándo recibes notificaciones?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { icon: '⏰', text: 'Tareas vencidas asignadas a ti' },
            { icon: '📋', text: 'Tareas que vencen hoy' },
            { icon: '🔄', text: 'Deals que cambian de etapa (tus deals)' },
            { icon: '⚠️', text: 'Deals marcados como Perdido/Frío/No Calificado (gerentes)' },
            { icon: '⚡', text: 'Automatizaciones configuradas con "Notificar"' },
            { icon: '🎉', text: 'Deals cerrados como Ganados' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-base leading-none">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <NotificationsList
        initialNotifications={notifications ?? []}
        userId={user.id}
      />
    </div>
  )
}
