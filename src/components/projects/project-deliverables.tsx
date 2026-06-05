'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, Plus, X, Calendar, Package } from 'lucide-react'

export default function ProjectDeliverables({ projectId, deliverables }: { projectId: string; deliverables: any[] }) {
  const [list, setList] = useState(deliverables)
  const [showing, setShowing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd() {
    if (!title.trim()) return
    setLoading(true)
    const { data } = await supabase.from('project_deliverables')
      .insert({ project_id: projectId, title, description: description || null, due_date: dueDate || null })
      .select('*').single()
    if (data) { setList([...list, data]); setTitle(''); setDescription(''); setDueDate(''); setShowing(false) }
    setLoading(false)
    router.refresh()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('project_deliverables')
      .update({ is_completed: !current, completed_at: !current ? new Date().toISOString() : null }).eq('id', id)
    setList(list.map(d => d.id === id ? { ...d, is_completed: !current } : d))
    router.refresh()
  }

  const pending = list.filter(d => !d.is_completed)
  const done = list.filter(d => d.is_completed)
  const progress = list.length > 0 ? Math.round((done.length / list.length) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Entregables</h2>
          {list.length > 0 && (
            <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
              {done.length}/{list.length}
            </span>
          )}
        </div>
        <button onClick={() => setShowing(!showing)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
            showing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}>
          {showing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showing ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      {/* Barra de progreso */}
      {list.length > 0 && (
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            </div>
            <span className="text-xs font-bold text-slate-600 tabular-nums">{progress}%</span>
          </div>
        </div>
      )}

      {showing && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del entregable"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción (opcional)"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400" />
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Fecha límite (opcional)
            </label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
          <button onClick={handleAdd} disabled={loading || !title.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus className="w-3.5 h-3.5" />{loading ? 'Guardando...' : 'Agregar entregable'}
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {list.length === 0 && !showing && (
          <div className="px-5 py-10 text-center">
            <Package className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Sin entregables aún</p>
          </div>
        )}
        {pending.map((d: any) => (
          <div key={d.id} className="px-5 py-3.5 flex items-start gap-3.5 hover:bg-slate-50/50 transition-colors">
            <button onClick={() => handleToggle(d.id, d.is_completed)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform">
              <Circle className="w-4 h-4 text-slate-300 hover:text-indigo-500 transition-colors" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{d.title}</p>
              {d.description && <p className="text-xs text-slate-400 mt-0.5">{d.description}</p>}
              {d.due_date && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(d.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                </p>
              )}
            </div>
          </div>
        ))}
        {done.length > 0 && (
          <div className="divide-y divide-slate-50 opacity-50">
            {done.map((d: any) => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3.5">
                <button onClick={() => handleToggle(d.id, d.is_completed)} className="shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </button>
                <p className="text-sm text-slate-500 line-through">{d.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
