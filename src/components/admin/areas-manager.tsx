'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Tags, X, Plus, Trash2, Loader2 } from 'lucide-react'

export interface Area {
  id: string
  name: string
  color: string
}

interface Props {
  areas: Area[]
}

const PALETTE = [
  '#7c3aed', '#2563eb', '#db2777', '#f59e0b',
  '#16a34a', '#0891b2', '#64748b', '#9333ea',
  '#dc2626', '#0d9488', '#ca8a04', '#4f46e5',
]

export default function AreasManager({ areas }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function addArea() {
    const n = name.trim()
    if (!n || saving) return
    setSaving(true); setError('')
    const { error: e } = await supabase.from('areas').insert({ name: n, color })
    setSaving(false)
    if (e) { setError(/duplicate|unique/i.test(e.message) ? 'Ya existe un área con ese nombre' : e.message); return }
    setName(''); setColor(PALETTE[0])
    router.refresh()
  }

  async function removeArea(id: string) {
    await supabase.from('areas').delete().eq('id', id)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-all">
        <Tags className="w-4 h-4 text-slate-500" />
        Áreas
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center">
                <Tags className="w-4 h-4 text-indigo-300" />
              </div>
              <h2 className="flex-1 text-sm font-bold text-white">Áreas / Departamentos</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Lista de áreas */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {areas.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No hay áreas todavía. Crea la primera abajo.</p>
                )}
                {areas.map(a => (
                  <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 group">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: a.color }} />
                    <span className="flex-1 text-sm font-medium text-slate-700">{a.name}</span>
                    <button onClick={() => removeArea(a.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
                      title="Eliminar área">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Crear área */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <label className="text-xs font-semibold text-slate-600 block">Nueva área</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addArea() }}
                  placeholder="Ej: Recursos Humanos"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                      style={{ background: c }} />
                  ))}
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button onClick={addArea} disabled={saving || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2 disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Agregar área
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
