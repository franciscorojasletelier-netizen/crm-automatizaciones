export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, Clock, AlertTriangle, CheckSquare } from 'lucide-react'
import TaskCheck from '@/components/tareas/task-check'
import NewTaskButton from '@/components/tareas/new-task-button'
import Link from 'next/link'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

function isDueSoon(due: string | null) {
  if (!due) return false
  const diff = new Date(due).getTime() - Date.now()
  return diff > 0 && diff < 1000 * 60 * 60 * 48
}

function formatDateTime(date: string | null) {
  if (!date) return { date: '—', time: null }
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  // Show time only if it's not midnight (has a specific hour/minute set)
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  const timeStr = hasTime ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null
  return { date: dateStr, time: timeStr }
}

export default async function TareasPage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, due_date, is_completed, created_at,
      deals(id, companies(name)),
      profiles:assigned_to(full_name)
    `)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })
    .limit(200)

  const pending = tasks?.filter(t => !t.is_completed) ?? []
  const completed = tasks?.filter(t => t.is_completed) ?? []
  const overdue = pending.filter(t => isOverdue(t.due_date))
  const dueSoon = pending.filter(t => !isOverdue(t.due_date) && isDueSoon(t.due_date))
  const normal = pending.filter(t => !isOverdue(t.due_date) && !isDueSoon(t.due_date))

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{pending.length}</span> pendientes ·{' '}
            <span className="font-semibold text-slate-700">{completed.length}</span> completadas
          </p>
        </div>
        <NewTaskButton />
      </div>

      {/* Stats rápidas */}
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

      {/* Vencidas */}
      {overdue.length > 0 && (
        <TaskSection
          title="Vencidas"
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          badge={<span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{overdue.length}</span>}
          borderColor="border-red-200"
          tasks={overdue}
          variant="overdue"
        />
      )}

      {/* Por vencer pronto */}
      {dueSoon.length > 0 && (
        <TaskSection
          title="Por vencer (48h)"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          badge={<span className="text-xs font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{dueSoon.length}</span>}
          borderColor="border-amber-200"
          tasks={dueSoon}
          variant="soon"
        />
      )}

      {/* Pendientes normales */}
      {normal.length > 0 && (
        <TaskSection
          title="Pendientes"
          icon={<CheckSquare className="w-4 h-4 text-indigo-500" />}
          tasks={normal}
          variant="normal"
        />
      )}

      {pending.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="text-slate-700 font-semibold">¡Todo al día!</p>
          <p className="text-sm text-slate-400">No hay tareas pendientes</p>
        </div>
      )}

      {/* Completadas */}
      {completed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden opacity-70">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-500">Completadas ({completed.length})</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {completed.map((task: any) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400 line-through">{task.title}</p>
                  {task.deals?.companies?.name && (
                    <p className="text-xs text-slate-300 mt-0.5">{task.deals.companies.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskSection({ title, icon, badge, borderColor = 'border-slate-200', tasks, variant }: {
  title: string
  icon: React.ReactNode
  badge?: React.ReactNode
  borderColor?: string
  tasks: any[]
  variant: 'overdue' | 'soon' | 'normal'
}) {
  const rowHover = variant === 'overdue' ? 'hover:bg-red-50/40'
                 : variant === 'soon'    ? 'hover:bg-amber-50/40'
                 : 'hover:bg-slate-50'

  const dateBg = variant === 'overdue' ? 'bg-red-50 text-red-600 border border-red-100'
               : variant === 'soon'    ? 'bg-amber-50 text-amber-600 border border-amber-100'
               : 'bg-slate-100 text-slate-500'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${borderColor}`}>
      <div className={`px-5 py-3.5 border-b ${borderColor} flex items-center gap-2`}>
        {icon}
        <h2 className="text-sm font-semibold text-slate-800 flex-1">{title}</h2>
        {badge}
      </div>
      <div className="divide-y divide-slate-50">
        {tasks.map((task: any) => {
          const isOv = variant === 'overdue'
          const { date: dateStr, time: timeStr } = formatDateTime(task.due_date)
          return (
            <div key={task.id} className={`px-5 py-3.5 flex items-start gap-3.5 transition-colors ${rowHover}`}>
              <div className="mt-0.5">
                <TaskCheck taskId={task.id} isCompleted={false} isOverdue={isOv} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {task.deals?.companies?.name && (
                    <Link href={`/leads/${task.deals.id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md transition-colors">
                      {task.deals.companies.name}
                    </Link>
                  )}
                  {task.profiles?.full_name && (
                    <span className="text-xs text-slate-400 font-medium">{task.profiles.full_name}</span>
                  )}
                </div>
              </div>
              {task.due_date && (
                <div className="shrink-0 text-right space-y-1">
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${dateBg}`}>
                    {dateStr}
                  </div>
                  {timeStr && (
                    <div className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center gap-1 justify-center">
                      <Clock className="w-3 h-3" />{timeStr}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
