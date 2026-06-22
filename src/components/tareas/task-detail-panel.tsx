'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  X, Calendar, Clock, MessageSquare, History,
  AlertTriangle, CheckCircle2, User, Building2,
  Save, ChevronRight
} from 'lucide-react'

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  is_completed: boolean
  deals: { id: string; companies: { name: string } | null } | null
  profiles: { full_name: string } | null
}

type HistoryEntry = {
  id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  comment: string
  created_at: string
  changer: { full_name: string } | null
}

const FIELD_LABELS: Record<string, string> = {
  due_date:    'Fecha/hora',
  title:       'Título',
  description: 'Descripción',
  is_completed:'Estado',
}

function formatDt(dt: string | null) {
  if (!dt) return 'Sin fecha'
  const d = new Date(dt)
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  return d.toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TaskDetailPanel({
  task,
  onClose,
  readOnly,
}: {
  task: Task
  onClose: () => void
  readOnly?: boolean
}) {
  const supabase = createClient()
  const router = useRouter()

  const [newDate, setNewDate] = useState(toDatetimeLocal(task.due_date))
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Load history
  useEffect(() => {
    async function load() {
      setLoadingHistory(true)
      const { data } = await supabase
        .from('task_history')
        .select('*, changer:changed_by(full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setHistory((data as any) ?? [])
      setLoadingHistory(false)
    }
    load()
  }, [task.id])

  const dateChanged = newDate !== toDatetimeLocal(task.due_date)
  const canSave = dateChanged && comment.trim().length >= 5

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError('')

    const oldIso = task.due_date
    const newIso = newDate ? new Date(newDate).toISOString() : null

    // Get current user id for audit
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveError('No autenticado'); setSaving(false); return }

    // Update task
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ due_date: newIso })
      .eq('id', task.id)

    if (updateErr) {
      setSaveError(updateErr.message)
      setSaving(false)
      return
    }

    // Insert history — changed_by required by RLS
    const { error: histErr } = await supabase.from('task_history').insert({
      task_id:       task.id,
      changed_by:    user.id,
      field_changed: 'due_date',
      old_value:     oldIso,
      new_value:     newIso,
      comment:       comment.trim(),
    })
    if (histErr) {
      setSaveError('Tarea actualizada, pero error al guardar historial: ' + histErr.message)
      setSaving(false)
      return
    }

    setComment('')
    router.refresh()
    onClose()
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Slide panel */}
      <div
        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3 bg-slate-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
              {task.is_completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              <h2 className="text-base font-bold text-slate-900 leading-snug">{task.title}</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {task.deals?.companies?.name && (
                <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">
                  <Building2 className="w-3 h-3" />{task.deals.companies.name}
                </span>
              )}
              {task.profiles?.full_name && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <User className="w-3 h-3" />{task.profiles.full_name}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Description */}
          {task.description && (
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Descripción</p>
              <p className="text-sm text-slate-700 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Edit date/time */}
          {readOnly ? (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Fecha programada</p>
                  <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                    {formatDt(task.due_date)}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Tienes acceso de solo lectura a esta sección.</p>
            </div>
          ) : (
          <div className="px-5 py-5 border-b border-slate-100 space-y-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Reprogramar tarea
            </p>

            {/* Current date */}
            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Fecha actual</p>
                <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                  {formatDt(task.due_date)}
                </p>
              </div>
            </div>

            {/* New date input */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Nueva fecha y hora
              </label>
              <input
                type="datetime-local"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            {/* Comment — required */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                Motivo del cambio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Explica brevemente por qué se reprograma esta tarea..."
                rows={3}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none placeholder:text-slate-400 transition-colors ${
                  dateChanged && comment.trim().length < 5 && comment.length > 0
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-slate-200'
                }`}
              />
              {dateChanged && comment.trim().length < 5 && comment.length > 0 && (
                <p className="text-xs text-red-500 mt-1">Escribe al menos 5 caracteres</p>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:shadow-md disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar cambio'}
            </button>
          </div>
          )}

          {/* History timeline */}
          <div className="px-5 py-5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-4">
              <History className="w-3.5 h-3.5" /> Historial de cambios
            </p>

            {loadingHistory ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Sin cambios registrados aún</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100" />

                <div className="space-y-5">
                  {history.map((entry, i) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 ${
                        i === 0 ? 'border-indigo-500 bg-indigo-100' : 'border-slate-300 bg-white'
                      }`} />
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">
                            {FIELD_LABELS[entry.field_changed] ?? entry.field_changed}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                            {new Date(entry.created_at).toLocaleDateString('es-CL', {
                              day: '2-digit', month: 'short',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {/* Old → New */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded line-through">
                            {entry.field_changed === 'due_date' ? formatDt(entry.old_value) : (entry.old_value ?? '—')}
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                            {entry.field_changed === 'due_date' ? formatDt(entry.new_value) : (entry.new_value ?? '—')}
                          </span>
                        </div>
                        {/* Comment */}
                        <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            <span className="font-semibold">{entry.changer?.full_name ?? 'Usuario'}:</span>{' '}
                            {entry.comment}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
