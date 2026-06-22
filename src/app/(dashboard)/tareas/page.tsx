export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import NewTaskButton from '@/components/tareas/new-task-button'
import TasksTable from '@/components/tareas/tasks-table'

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
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{pending.length}</span> pendientes ·{' '}
            <span className="font-semibold text-slate-700">{completed.length}</span> completadas
          </p>
        </div>
        {canEdit && <NewTaskButton />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{overdue.length}</p>
            <p className="text-xs text-slate-500 font-medium">Vencidas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{dueSoon.length}</p>
            <p className="text-xs text-slate-500 font-medium">Por vencer</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{completed.length}</p>
            <p className="text-xs text-slate-500 font-medium">Completadas</p>
          </div>
        </div>
      </div>

      {/* Tabla con búsqueda y filtros */}
      <TasksTable tasks={all as any} readOnly={!canEdit} />
    </div>
  )
}
