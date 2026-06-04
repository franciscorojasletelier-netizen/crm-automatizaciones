export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle } from 'lucide-react'
import TaskCheck from '@/components/tareas/task-check'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function TareasPage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, due_date, is_completed, created_at,
      deals(
        id,
        companies(name)
      ),
      profiles:assigned_to(full_name)
    `)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })
    .limit(50)

  const pending = tasks?.filter(t => !t.is_completed) ?? []
  const completed = tasks?.filter(t => t.is_completed) ?? []

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
        <p className="text-sm text-gray-500">{pending.length} pendientes · {completed.length} completadas</p>
      </div>

      {/* Pendientes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3.5 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-900">Pendientes</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {pending.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No hay tareas pendientes</p>
          )}
          {pending.map((task: any) => {
            const overdue = isOverdue(task.due_date)
            return (
              <div key={task.id} className="px-5 py-3.5 flex items-start gap-3">
                <TaskCheck taskId={task.id} isCompleted={false} isOverdue={overdue} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {task.deals?.companies?.name && (
                      <span className="text-xs text-gray-500">{task.deals.companies.name}</span>
                    )}
                    {task.profiles?.full_name && (
                      <span className="text-xs text-gray-400">→ {task.profiles.full_name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Completadas */}
      {completed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-500">Completadas</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {completed.map((task: any) => (
              <div key={task.id} className="px-5 py-3.5 flex items-start gap-3 opacity-50">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-500 line-through">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
