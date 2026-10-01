'use client'

// Recordatorios manuales de vencimiento (token de Supabase, dominio,
// planes…): lo que el sistema no puede consultar por sí solo.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'

export interface Reminder {
  id: string
  name: string
  category: 'token' | 'dominio' | 'plan' | 'certificado' | 'otro'
  expires_on: string | null
  url: string | null
  notes: string | null
}

const CATEGORY_LABEL: Record<Reminder['category'], string> = {
  token: 'Token / clave', dominio: 'Dominio', plan: 'Plan o suscripción', certificado: 'Certificado', otro: 'Otro',
}

type Draft = Omit<Reminder, 'id'>
const EMPTY: Draft = { name: '', category: 'otro', expires_on: null, url: null, notes: null }

function ReminderForm({ initial, onDone, onCancel }: { initial?: Reminder; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial ?? EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!d.name.trim()) { setError('Ponle un nombre.'); return }
    if (d.url && !/^https?:\/\//i.test(d.url)) { setError('El enlace debe empezar con https://'); return }
    setBusy(true); setError('')
    const row = { ...d, name: d.name.trim(), url: d.url?.trim() || null, notes: d.notes?.trim() || null, updated_at: new Date().toISOString() }
    const sb = createClient()
    const { error: err } = initial
      ? await sb.from('service_reminders').update(row).eq('id', initial.id)
      : await sb.from('service_reminders').insert(row)
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
        <div>
          <label htmlFor="rem-name" className={labelClass}>Qué vence</label>
          <input id="rem-name" value={d.name} onChange={e => set('name', e.target.value)} maxLength={120}
            placeholder="Ej.: Dominio autopilot.cl" className={inputClass} autoFocus />
        </div>
        <div>
          <label htmlFor="rem-cat" className={labelClass}>Tipo</label>
          <select id="rem-cat" value={d.category} onChange={e => set('category', e.target.value as Reminder['category'])} className={inputClass}>
            {(Object.keys(CATEGORY_LABEL) as Reminder['category'][]).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rem-date" className={labelClass}>Vence el</label>
          <input id="rem-date" type="date" value={d.expires_on ?? ''} onChange={e => set('expires_on', e.target.value || null)} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rem-url" className={labelClass}>Enlace para renovar <span className="font-normal text-slate-500">(opcional)</span></label>
          <input id="rem-url" type="url" value={d.url ?? ''} onChange={e => set('url', e.target.value)} placeholder="https://" className={inputClass} />
        </div>
        <div>
          <label htmlFor="rem-notes" className={labelClass}>Nota <span className="font-normal text-slate-500">(opcional)</span></label>
          <input id="rem-notes" value={d.notes ?? ''} onChange={e => set('notes', e.target.value)} maxLength={1000} className={inputClass} />
        </div>
      </div>
      {error && <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={buttonClass.ghost}><X className="w-3.5 h-3.5" />Cancelar</button>
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
        </button>
      </div>
    </form>
  )
}

export function AddReminderButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  if (open) return <ReminderForm onDone={() => { setOpen(false); router.refresh() }} onCancel={() => setOpen(false)} />
  return (
    <button type="button" onClick={() => setOpen(true)} className={buttonClass.secondary}>
      <Plus className="w-3.5 h-3.5" /> Agregar vencimiento
    </button>
  )
}

export function ReminderActions({ reminder }: { reminder: Reminder }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function remove() {
    if (!confirm(`¿Eliminar "${reminder.name}"?`)) return
    setBusy(true)
    await createClient().from('service_reminders').delete().eq('id', reminder.id)
    setBusy(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="mt-3 w-full">
        <ReminderForm initial={reminder} onDone={() => { setEditing(false); router.refresh() }} onCancel={() => setEditing(false)} />
      </div>
    )
  }
  return (
    <div className={cn('flex items-center gap-1 shrink-0')}>
      <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${reminder.name}`} className={buttonClass.ghost}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={remove} disabled={busy} aria-label={`Eliminar ${reminder.name}`} className={cn(buttonClass.ghost, 'hover:text-red-700')}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
