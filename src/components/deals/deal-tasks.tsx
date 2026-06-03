'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle, Plus, AlertCircle } from 'lucide-react'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

export default function DealTasks({
  dealId,
  tasks,
}: {
  dealId: string
  tasks: any[]
}) {
  const [list, setList] = useState(tasks)
  const [showing, setShowing] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd() {
    if (!title.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('tasks')
      .insert({
        deal_id: dealId,
        title,
        due_date: dueDate || null,
      })
      .select('*, profiles:assigned_to(full_name)')
      .single()

    if (data) {
      setList([...list, data])
      setTitle('')
      setDueDate('')
      setShowing(false)
    }
    setLoading(false)
    router.refresh()
  }

  async function handleToggle(taskId: string, current: boolean) {
    await supabase
      .from('tasks')
      .update({ is_completed: !current, completed_at: !current ? new Date().toISOString() : null })
      .eq('id', taskId)

    setList(list.map(t => t.id === taskId ? { ...t, is_completed: !current } : t))
    router.refresh()
  }

  const pending = list.filter(t => !t.is_completed)
  const done = list.filter(t => t.is_completed)

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">
          Tareas
          {pending.length > 0 && (
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {pending.length} pendiente{pending.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowing(!showing)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva tarea
        </button>
      </div>

      {showing && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-3 bg-gray-50">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Descripción de la tarea"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Fecha límite (opcional)</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !title.trim()}
              className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Crear tarea'}
            </button>
            <button
              onClick={() => setShowing(false)}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {list.length === 0 && !showing && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin tareas aún</p>
        )}
        {pending.map((task: any) => {
          const overdue = isOverdue(task.due_date)
          return (
            <div key={task.id} className="px-4 py-3 flex items-start gap-3">
              <button onClick={() => handleToggle(task.id, task.is_completed)} className="mt-0.5 shrink-0">
                {overdue
                  ? <AlertCircle className="w-4 h-4 text-red-500" />
                  : <Circle className="w-4 h-4 text-gray-300 hover:text-gray-500" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{task.title}</p>
                {task.due_date && (
                  <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {overdue ? '⚠ Vencida · ' : ''}
                    {new Date(task.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        {done.map((task: any) => (
          <div key={task.id} className="px-4 py-3 flex items-start gap-3 opacity-40">
            <button onClick={() => handleToggle(task.id, task.is_completed)} className="mt-0.5 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </button>
            <p className="text-sm text-gray-500 line-through">{task.title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
