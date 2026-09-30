export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import NewTaskButton from '@/components/tareas/new-task-button'
import TasksTable from '@/components/tareas/tasks-table'
import { Stat, StatStrip } from '@/components/ui/page'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

function isDueSoon(due: string | null) {
  if (!due) return false
  const diff = new Date(due).getTime() - Date.now()
  return diff > 0 && diff < 1000 * 60 * 60 * 48
}

export default async function TareasPage() {
  const { user, role, supabase, canEdit } = await requirePermission('tareas')

  // Gerente/admin ven todas las tareas; el resto solo las suyas
  const seesAll = ['super_admin', 'gerente'].includes(role)

  let query = supabase
    .from('tasks')
    .select(`
      id, title, description, due_date, is_completed, created_at,
      deals(id, companies(name)),
      profiles:assigned_to(full_name)
    `)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })
    .limit(200)

  if (!seesAll) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
  }

  const { data: tasks } = await query

  const all      = tasks ?? []
  const pending  = all.filter(t => !t.is_completed)
  const completed = all.filter(t => t.is_completed)
  const overdue  = pending.filter(t => isOverdue(t.due_date))
  const dueSoon  = pending.filter(t => !isOverdue(t.due_date) && isDueSoon(t.due_date))

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-7 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900">Tareas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{pending.length}</span> pendientes ·{' '}
            <span className="font-semibold text-slate-700">{completed.length}</span> completadas
          </p>
        </div>
        {canEdit && <NewTaskButton />}
      </div>

      {/* Stats */}
      <StatStrip className="grid-cols-3 lg:grid-cols-3">
        <Stat label="Vencidas" value={overdue.length} tone={overdue.length > 0 ? 'danger' : 'neutral'} />
        <Stat label="Por vencer" value={dueSoon.length} tone={dueSoon.length > 0 ? 'warning' : 'neutral'} />
        <Stat label="Completadas" value={completed.length} />
      </StatStrip>

      {/* Tabla con búsqueda y filtros */}
      <TasksTable tasks={all as any} readOnly={!canEdit} />
    </div>
  )
}
