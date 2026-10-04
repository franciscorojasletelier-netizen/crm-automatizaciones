export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { chileDateString } from '@/lib/dates'
import CalendarView from '@/components/calendar/calendar-view'

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { user, role, supabase } = await getCurrentProfile()

  // Mes visible (?mes=2026-12); por defecto el actual en Chile. Se traen sus
  // tareas con una semana de margen a cada lado (husos y bordes de mes).
  const { mes } = await searchParams
  const [cy, cm] = chileDateString().split('-').map(Number)
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? '')
  const year = m ? Number(m[1]) : cy
  const month = m ? Math.min(12, Math.max(1, Number(m[2]))) - 1 : cm - 1
  const start = new Date(Date.UTC(year, month, 1) - 7 * 86400_000).toISOString()
  const end   = new Date(Date.UTC(year, month + 1, 1) + 7 * 86400_000).toISOString()

  let query = supabase
    .from('tasks')
    .select(`
      id, title, due_date, is_completed,
      deals(id, companies(name)),
      profiles:assigned_to(full_name)
    `)
    .gte('due_date', start)
    .lt('due_date', end)
    .order('due_date', { ascending: true })

  // Solo gerente/admin ven el calendario de todo el equipo; el resto ve sus tareas
  if (!['super_admin', 'gerente'].includes(role)) {
    query = query.eq('assigned_to', user.id)
  }

  const { data: tasks } = await query.limit(500)

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="mb-5">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900">Calendario</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vista mensual de tareas y actividades</p>
      </div>
      <CalendarView key={`${year}-${month}`} year={year} month={month} tasks={(tasks ?? []) as unknown as React.ComponentProps<typeof CalendarView>['tasks']} />
    </div>
  )
}
