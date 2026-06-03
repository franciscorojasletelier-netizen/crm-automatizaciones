'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle, Plus } from 'lucide-react'

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
    const { data } = await supabase
      .from('project_deliverables')
      .insert({ project_id: projectId, title, description: description || null, due_date: dueDate || null })
      .select('*').single()
    if (data) { setList([...list, data]); setTitle(''); setDescription(''); setDueDate(''); setShowing(false) }
    setLoading(false)
    router.refresh()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('project_deliverables')
      .update({ is_completed: !current, completed_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
    setList(list.map(d => d.id === id ? { ...d, is_completed: !current } : d))
    router.refresh()
  }

  const pending = list.filter(d => !d.is_completed)
  const done = list.filter(d => d.is_completed)

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">
          Entregables
          {pending.length > 0 && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pending.length} pendiente{pending.length > 1 ? 's' : ''}</span>}
        </h2>
        <button onClick={() => setShowing(!showing)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {showing && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-3 bg-gray-50">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del entregable"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción (opcional)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha límite (opcional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading || !title.trim()}
              className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Guardando...' : 'Agregar'}
            </button>
            <button onClick={() => setShowing(false)} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-900">Cancelar</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {list.length === 0 && !showing && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin entregables aún</p>
        )}
        {pending.map((d: any) => (
          <div key={d.id} className="px-4 py-3 flex items-start gap-3">
            <button onClick={() => handleToggle(d.id, d.is_completed)} className="mt-0.5 shrink-0">
              <Circle className="w-4 h-4 text-gray-300 hover:text-gray-500" />
            </button>
            <div className="flex-1">
              <p className="text-sm text-gray-800">{d.title}</p>
              {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
              {d.due_date && <p className="text-xs text-gray-400 mt-0.5">{new Date(d.due_date).toLocaleDateString('es-CL')}</p>}
            </div>
          </div>
        ))}
        {done.map((d: any) => (
          <div key={d.id} className="px-4 py-3 flex items-start gap-3 opacity-40">
            <button onClick={() => handleToggle(d.id, d.is_completed)} className="mt-0.5 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </button>
            <p className="text-sm text-gray-500 line-through">{d.title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
