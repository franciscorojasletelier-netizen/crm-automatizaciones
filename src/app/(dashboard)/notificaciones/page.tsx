export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import NotificationsList from '@/components/notifications/notifications-list'
import { CHILE_TZ, chileDayStart } from '@/lib/dates'

export default async function NotificacionesPage() {
  const { user, supabase } = await getCurrentProfile()

  const now   = new Date()
  // Día calendario de Chile, no de UTC (el servidor corre en UTC)
  const today    = chileDayStart(0, now).toISOString()
  const todayEnd = chileDayStart(1, now).toISOString()

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
      .lt('due_date', todayEnd)
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
    const dueStr  = new Date(task.due_date!).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: '2-digit', month: 'short' })
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
      ? new Date(task.due_date).toLocaleTimeString('es-CL', { timeZone: CHILE_TZ, hour: '2-digit', minute: '2-digit' })
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
            'Tareas vencidas asignadas a ti',
            'Tareas que vencen hoy',
            'Deals tuyos que cambian de etapa',
            'Deals marcados como perdidos, fríos o no calificados (gerencia)',
            'Automatizaciones configuradas con "Notificar"',
            'Deals ganados',
            'Documentos de cobranza que vencen y compromisos de pago del día',
          ].map(text => (
            <div key={text} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" aria-hidden />
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
