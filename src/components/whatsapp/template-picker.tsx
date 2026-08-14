'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  content: string
  created_by: string | null
}

export default function TemplatePicker({
  contactName, onPick,
}: {
  contactName: string
  onPick: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false) }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: templatesData }, { data: { user } }] = await Promise.all([
      supabase.from('whatsapp_templates').select('id, name, content, created_by').order('name'),
      supabase.auth.getUser(),
    ])
    setTemplates(templatesData ?? [])
    setUserId(user?.id ?? null)
    setLoading(false)
  }

  function toggle() {
    if (!open) load()
    setOpen(v => !v)
  }

  function pick(t: Template) {
    const firstName = contactName?.split(' ')[0] ?? ''
    const resolved = t.content.replace(/\{\{\s*nombre\s*\}\}/gi, firstName)
    onPick(resolved)
    setOpen(false)
  }

  async function saveNew() {
    if (!newName.trim() || !newContent.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({ name: newName.trim(), content: newContent.trim() })
      .select('id, name, content, created_by')
      .single()
    setSaving(false)
    if (!error && data) {
      setTemplates(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName(''); setNewContent(''); setCreating(false)
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} title="Plantillas de mensaje"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors shrink-0">
        <FileText className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-10 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">Plantillas</p>
            <button onClick={() => setCreating(v => !v)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Nueva
            </button>
          </div>

          {creating && (
            <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre (ej: Primer contacto)"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={3} placeholder="Mensaje... usá {{nombre}} para el nombre del contacto"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <button onClick={saveNew} disabled={saving || !newName.trim() || !newContent.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-1.5 rounded-lg transition-colors">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar plantilla'}
              </button>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {loading && <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>}
            {!loading && templates.length === 0 && !creating && (
              <p className="text-xs text-slate-400 text-center py-6 px-3">Sin plantillas todavía. Creá la primera con "Nueva".</p>
            )}
            {templates.map(t => (
              <div key={t.id} className="group flex items-start gap-1.5 px-3 py-2 hover:bg-slate-50 transition-colors">
                <button onClick={() => pick(t)} className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.content}</p>
                </button>
                {t.created_by === userId && (
                  <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
