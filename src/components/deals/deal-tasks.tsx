'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, Plus, AlertTriangle, X, Calendar } from 'lucide-react'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

export default function DealTasks({ dealId, tasks }: { dealId: string; tasks: any[] }) {
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
      .insert({ deal_id: dealId, title, due_date: dueDate || null })
      .select('*, profiles:assigned_to(full_name)')
      .single()
    if (data) { setList([...list, data]); setTitle(''); setDueDate(''); setShowing(false) }
    setLoading(false)
    router.refresh()
  }

  async function handleToggle(taskId: string, current: boolean) {
    await supabase.from('tasks').update({ is_completed: !current, completed_at: !current ? new Date().toISOString() : null }).eq('id', taskId)
    setList(list.map(t => t.id === taskId ? { ...t, is_completed: !current } : t))
    router.refresh()
  }

  const pending = list.filter(t => !t.is_completed)
  const done = list.filter(t => t.is_completed)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Tareas</h2>
          {pending.length > 0 && (
            <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
              {pending.length} pendiente{pending.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setShowing(!showing)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
            showing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}>
          {showing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showing ? 'Cancelar' : 'Nueva tarea'}
        </button>
      </div>

      {showing && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Descripción de la tarea..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400"
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleAdd() }}
          />
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Fecha límite (opcional)
            </label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
          <button onClick={handleAdd} disabled={loading || !title.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus className="w-3.5 h-3.5" />
            {loading ? 'Guardando...' : 'Crear tarea'}
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {list.length === 0 && !showing && (
          <div className="px-5 py-10 text-center">
            <CheckCircle2 className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Sin tareas aún</p>
          </div>
        )}

        {pending.map((task: any) => {
          const overdue = isOverdue(task.due_date)
          return (
            <div key={task.id} className={`px-5 py-3.5 flex items-start gap-3.5 transition-colors ${overdue ? 'hover:bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
              <button onClick={() => handleToggle(task.id, task.is_completed)} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
                {overdue
                  ? <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
                  : <Circle className="w-4.5 h-4.5 text-slate-300 hover:text-indigo-500 transition-colors" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{task.title}</p>
                {task.due_date && (
                  <p className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                    <Calendar className="w-3 h-3" />
                    {overdue ? 'Vencida · ' : ''}
                    {new Date(task.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {done.length > 0 && (
          <div className="divide-y divide-slate-50 opacity-50">
            {done.map((task: any) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3.5">
                <button onClick={() => handleToggle(task.id, task.is_completed)} className="shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </button>
                <p className="text-sm text-slate-500 line-through">{task.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
