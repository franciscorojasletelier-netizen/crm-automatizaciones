export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import CalendarView from '@/components/calendar/calendar-view'

export default async function CalendarioPage() {
  const { user, role, supabase } = await getCurrentProfile()

  // Traer tareas del próximo y anterior mes para navegación
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const end   = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  let query = supabase
    .from('tasks')
    .select(`
      id, title, due_date, is_completed, priority,
      deals(id, companies(name)),
      profiles:assigned_to(full_name)
    `)
    .gte('due_date', start)
    .lte('due_date', end)
    .order('due_date', { ascending: true })

  // Ejecutivos solo ven sus tareas
  if (role === 'comercial') {
    query = query.eq('assigned_to', user.id)
  }

  const { data: tasks } = await query.limit(300)

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vista mensual de tareas y actividades</p>
      </div>
      <CalendarView tasks={(tasks ?? []) as any} />
    </div>
  )
}
