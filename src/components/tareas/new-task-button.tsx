'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Calendar, Clock, AlertTriangle } from 'lucide-react'
import { checkTaskConflict, formatConflictTime, type ConflictTask } from '@/lib/task-conflict'

export default function NewTaskButton() {
  const [open, setOpen]             = useState(false)
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [conflicts, setConflicts]   = useState<ConflictTask[]>([])
  const [confirmed, setConfirmed]   = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleDateChange(value: string) {
    setDueDate(value)
    setConflicts([])
    setConfirmed(false)

    if (!value) return

    // Solo verificar si tiene hora (no solo fecha)
    const hasTime = value.includes('T') && !value.endsWith('T00:00')
    if (!hasTime) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const found = await checkTaskConflict(supabase, user.id, value)
    setConflicts(found)
  }

  async function handleCreate(force = false) {
    if (!title.trim()) return

    // Si hay conflictos y no se confirmó, mostrar advertencia primero
    if (conflicts.length > 0 && !force && !confirmed) {
      setConfirmed(true)  // abre el panel de confirmación
      return
    }

    setLoading(true)
    setError('')
    // Asignar al creador — sin assigned_to la tarea no aparece en recordatorios ni notificaciones
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('tasks').insert({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      deal_id: null,
      assigned_to: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setTitle('')
    setDescription('')
    setDueDate('')
    setConflicts([])
    setConfirmed(false)
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setTitle('')
    setDescription('')
    setDueDate('')
    setConflicts([])
    setConfirmed(false)
    setError('')
  }

  const hasConflict = conflicts.length > 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        <Plus className="w-4 h-4" />
        Nueva tarea
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Nueva tarea</h2>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Panel de confirmación de conflicto */}
            {confirmed && hasConflict ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-sm font-bold text-amber-800">
                      Conflicto de horario detectado
                    </p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Ya tienes {conflicts.length === 1 ? 'una tarea' : `${conflicts.length} tareas`} en ese horario (±30 min):
                  </p>
                  <div className="space-y-2">
                    {conflicts.map(c => (
                      <div key={c.id} className="flex items-start gap-2 bg-white rounded-xl px-3 py-2.5 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{c.title}</p>
                          <p className="text-[10px] text-slate-500">
                            {formatConflictTime(c.due_date)}
                            {c.company ? ` · ${c.company}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 font-medium">
                    ¿Igual quieres crear esta tarea?
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmed(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    ← Cambiar hora
                  </button>
                  <button
                    onClick={() => handleCreate(true)}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Guardando...' : 'Crear de todas formas'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Título *</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ej: Llamar a cliente, Preparar propuesta..."
                      autoFocus
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400"
                      onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleCreate() }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Descripción (opcional)</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Notas adicionales..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Fecha y hora (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={dueDate}
                      onChange={e => handleDateChange(e.target.value)}
                      className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-colors ${
                        hasConflict
                          ? 'border-amber-400 ring-amber-200 focus:ring-amber-400 bg-amber-50'
                          : 'border-slate-200 focus:ring-indigo-500'
                      }`}
                    />

                    {/* Advertencia de conflicto inline */}
                    {hasConflict ? (
                      <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-700 space-y-0.5">
                          <p className="font-bold">Conflicto de horario (±30 min)</p>
                          {conflicts.map(c => (
                            <p key={c.id}>
                              · {formatConflictTime(c.due_date)} — <span className="font-semibold">{c.title}</span>
                              {c.company ? ` (${c.company})` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Si agregas hora, aparecerá en el correo diario
                      </p>
                    )}
                  </div>
                </div>

                {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleCreate()}
                    disabled={loading || !title.trim()}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-md ${
                      hasConflict ? 'bg-amber-500 hover:bg-amber-600' : ''
                    }`}
                    style={hasConflict ? {} : { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    {loading ? 'Guardando...' : hasConflict ? '⚠️ Crear con conflicto' : 'Crear tarea'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
