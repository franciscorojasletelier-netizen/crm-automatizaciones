'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Check } from 'lucide-react'
import type { Stage } from '@/lib/stages'

const TRIGGER_TYPES = [
  { value: 'stage_change',  label: 'Cambio de etapa',         desc: 'Cuando un deal cambia a una etapa específica' },
  { value: 'days_inactive', label: 'Días sin actividad',       desc: 'Si un deal lleva X días sin cambios' },
  { value: 'deal_won',      label: 'Deal ganado',              desc: 'Cuando un deal se cierra como ganado' },
  { value: 'deal_lost',     label: 'Deal perdido',             desc: 'Cuando un deal se cierra como perdido' },
  { value: 'task_overdue',  label: 'Tarea vencida',            desc: 'Cuando una tarea pasa su fecha límite' },
]

const ACTION_TYPES = [
  { value: 'create_task',    label: 'Crear tarea automática',  desc: 'Genera una tarea al ejecutivo responsable' },
  { value: 'notify_owner',   label: 'Notificar al ejecutivo',  desc: 'Envía notificación al dueño del deal' },
  { value: 'notify_team',    label: 'Notificar al equipo',     desc: 'Notifica a todo el equipo' },
]

interface Props {
  createdBy: string
  stages: Stage[]
}

export default function AutomationRuleForm({ createdBy, stages }: Props) {
  // Las opciones salen del embudo de la organización, no de una lista fija.
  const STAGE_OPTIONS = [
    { value: 'any', label: 'Cualquier etapa' },
    ...stages.map(s => ({ value: s.key, label: s.label })),
  ]
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('stage_change')
  const [actionType, setActionType] = useState('notify_owner')
  const [toStage, setToStage] = useState('any')
  const [daysInactive, setDaysInactive] = useState(7)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDaysAfter, setTaskDaysAfter] = useState(2)
  const [notifMessage, setNotifMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')

    const triggerConfig: Record<string, any> = {}
    const actionConfig: Record<string, any> = {}

    if (triggerType === 'stage_change') triggerConfig.to_stage = toStage
    if (triggerType === 'days_inactive') triggerConfig.days = daysInactive
    if (actionType === 'create_task') { actionConfig.title = taskTitle || 'Tarea de seguimiento'; actionConfig.days_after = taskDaysAfter }
    if (actionType === 'notify_owner' || actionType === 'notify_team') {
      actionConfig.message = notifMessage || 'Automatización ejecutada'
    }

    const { error: err } = await supabase.from('automation_rules').insert({
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
      created_by: createdBy || null,
    })

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setName(''); setDescription(''); setTaskTitle(''); setNotifMessage('')
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-4">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Nueva regla</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Seguimiento propuesta"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Trigger */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Disparador</label>
          <select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900"
          >
            {TRIGGER_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            {TRIGGER_TYPES.find(t => t.value === triggerType)?.desc}
          </p>
        </div>

        {/* Config disparador */}
        {triggerType === 'stage_change' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Etapa destino</label>
            <select
              value={toStage}
              onChange={e => setToStage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900"
            >
              {STAGE_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
        {triggerType === 'days_inactive' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Días sin actividad</label>
            <input
              type="number"
              min={1} max={90}
              value={daysInactive}
              onChange={e => setDaysInactive(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900"
            />
          </div>
        )}

        {/* Acción */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Acción</label>
          <select
            value={actionType}
            onChange={e => setActionType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900"
          >
            {ACTION_TYPES.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            {ACTION_TYPES.find(a => a.value === actionType)?.desc}
          </p>
        </div>

        {/* Config acción */}
        {actionType === 'create_task' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título de la tarea</label>
              <input
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="Ej: Llamada de seguimiento"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vence en (días)</label>
              <input
                type="number" min={1} max={30}
                value={taskDaysAfter}
                onChange={e => setTaskDaysAfter(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900"
              />
            </div>
          </div>
        )}
        {(actionType === 'notify_owner' || actionType === 'notify_team') && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mensaje de notificación</label>
            <textarea
              value={notifMessage}
              onChange={e => setNotifMessage(e.target.value)}
              placeholder="Ej: Este deal necesita seguimiento"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Crear regla'}
        </button>
      </form>
    </div>
  )
}
