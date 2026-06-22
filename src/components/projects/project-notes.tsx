'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Lock, Send, X, StickyNote } from 'lucide-react'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function ProjectNotes({ projectId, notes, readOnly }: { projectId: string; notes: any[]; readOnly?: boolean }) {
  const [list, setList] = useState(notes)
  const [showing, setShowing] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd() {
    if (!content.trim()) return
    setLoading(true)
    const { data } = await supabase.from('project_notes')
      .insert({ project_id: projectId, content, is_internal: true })
      .select('*, profiles:user_id(full_name)').single()
    if (data) { setList([data, ...list]); setContent(''); setShowing(false) }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Notas internas</h2>
          <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
            <Lock className="w-2.5 h-2.5" /> Privado
          </span>
        </div>
        {!readOnly && (
          <button onClick={() => setShowing(!showing)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
              showing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}>
            {showing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showing ? 'Cancelar' : 'Agregar'}
          </button>
        )}
      </div>

      {showing && !readOnly && (
        <div className="p-4 border-b border-slate-100 bg-amber-50/50 space-y-3">
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="Nota interna del equipo (no visible para el cliente)..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400" />
          <button onClick={handleAdd} disabled={loading || !content.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Send className="w-3.5 h-3.5" />{loading ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {list.length === 0 && !showing && (
          <div className="px-5 py-10 text-center">
            <StickyNote className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Sin notas aún</p>
          </div>
        )}
        {list.map((note: any) => (
          <div key={note.id} className="px-5 py-3.5 flex gap-3.5 hover:bg-slate-50/50 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-3 h-3 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {note.profiles?.full_name && (
                  <span className="text-xs font-bold text-slate-700">{note.profiles.full_name}</span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">{timeAgo(note.created_at)}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
