'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { Plus, Trash2, Loader2, GitBranch, MessageCircle, CheckSquare, Bell, Users2 } from 'lucide-react'
import type { Stage } from '@/lib/stages'

interface Step {
  id: string
  step_order: number
  delay_hours: number
  action_type: 'send_whatsapp_template' | 'create_task' | 'notify_owner' | 'notify_team'
  action_config: any
}

interface Sequence {
  id: string
  name: string
  description: string | null
  trigger_type: 'stage_change' | 'deal_created'
  trigger_config: any
  is_active: boolean
  automation_sequence_steps: Step[]
}

interface Template {
  id: string
  name: string
}

const ACTION_LABELS: Record<Step['action_type'], { label: string; icon: typeof MessageCircle }> = {
  send_whatsapp_template: { label: 'Enviar WhatsApp', icon: MessageCircle },
  create_task:            { label: 'Crear tarea',      icon: CheckSquare },
  notify_owner:           { label: 'Notificar responsable', icon: Bell },
  notify_team:            { label: 'Notificar equipo', icon: Users2 },
}

function formatDelay(hours: number) {
  if (hours === 0) return 'Inmediato'
  if (hours < 24) return `${hours}h después`
  const days = Math.round(hours / 24)
  return `${days} día${days > 1 ? 's' : ''} después`
}

export default function SequencesManager({ sequences: initialSequences, stages, templates }: {
  sequences: Sequence[]; stages: Stage[]; templates: Template[]
}) {
  const [sequences, setSequences] = useState(initialSequences)
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState<'stage_change' | 'deal_created'>('stage_change')
  const [toStage, setToStage] = useState(stages[0]?.key ?? 'any')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function createSequence(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.from('automation_sequences').insert({
      name: name.trim(),
      trigger_type: triggerType,
      trigger_config: triggerType === 'stage_change' ? { to_stage: toStage } : {},
    }).select('*, automation_sequence_steps(*)').single()
    setSaving(false)
    if (err) { setError(friendlyError(err.message)); return }
    setSequences(prev => [{ ...data, automation_sequence_steps: [] }, ...prev])
    setName(''); setShowNew(false)
  }

  async function toggleActive(seq: Sequence) {
    const { error: err } = await supabase.from('automation_sequences')
      .update({ is_active: !seq.is_active }).eq('id', seq.id)
    if (!err) {
      setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, is_active: !s.is_active } : s))
      router.refresh()
    }
  }

  async function removeSequence(id: string) {
    if (!confirm('¿Eliminar esta secuencia? Los deals ya inscritos dejarán de avanzar por ella.')) return
    const { error: err } = await supabase.from('automation_sequences').delete().eq('id', id)
    if (!err) setSequences(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Secuencias de follow-up</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Pasos encadenados con espera entre cada uno — ej. WhatsApp a las 48h, tarea a los 5 días si sigue sin avanzar.</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
          <Plus className="w-3.5 h-3.5" /> Nueva
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {showNew && (
        <form onSubmit={createSequence} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="ej. Reactivación de leads fríos"
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Empieza cuando…</label>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full bg-white">
              <option value="stage_change">Un deal entra a una etapa</option>
              <option value="deal_created">Se crea un deal nuevo</option>
            </select>
          </div>
          {triggerType === 'stage_change' && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Etapa</label>
              <select value={toStage} onChange={e => setToStage(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full bg-white">
                <option value="any">Cualquier etapa</option>
                {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={saving}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear secuencia'}
          </button>
        </form>
      )}

      {sequences.length === 0 && !showNew && (
        <p className="text-xs text-slate-400 text-center py-6">Sin secuencias todavía.</p>
      )}

      <div className="space-y-3">
        {sequences.map(seq => (
          <SequenceCard key={seq.id} sequence={seq} stages={stages} templates={templates}
            onToggle={() => toggleActive(seq)} onRemove={() => removeSequence(seq.id)}
            onStepsChange={(steps) => setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, automation_sequence_steps: steps } : s))} />
        ))}
      </div>
    </div>
  )
}

function SequenceCard({ sequence, stages, templates, onToggle, onRemove, onStepsChange }: {
  sequence: Sequence; stages: Stage[]; templates: Template[]
  onToggle: () => void; onRemove: () => void; onStepsChange: (steps: Step[]) => void
}) {
  const [showAddStep, setShowAddStep] = useState(false)
  const [delayHours, setDelayHours] = useState(24)
  const [actionType, setActionType] = useState<Step['action_type']>('send_whatsapp_template')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [taskTitle, setTaskTitle] = useState('Tarea de seguimiento')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const triggerLabel = sequence.trigger_type === 'deal_created'
    ? 'Al crear un deal'
    : `Al entrar a: ${sequence.trigger_config?.to_stage === 'any' ? 'cualquier etapa' : (stages.find(s => s.key === sequence.trigger_config?.to_stage)?.label ?? sequence.trigger_config?.to_stage)}`

  async function addStep(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const config: any = {}
    if (actionType === 'send_whatsapp_template') config.template_id = templateId
    if (actionType === 'create_task') config.title = taskTitle
    if (actionType === 'notify_owner' || actionType === 'notify_team') config.message = message

    const nextOrder = (sequence.automation_sequence_steps?.length ?? 0) + 1
    const { data, error } = await supabase.from('automation_sequence_steps').insert({
      sequence_id: sequence.id, step_order: nextOrder, delay_hours: delayHours,
      action_type: actionType, action_config: config,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      onStepsChange([...(sequence.automation_sequence_steps ?? []), data])
      setShowAddStep(false); setMessage('')
    }
  }

  async function removeStep(id: string) {
    const { error } = await supabase.from('automation_sequence_steps').delete().eq('id', id)
    if (!error) onStepsChange((sequence.automation_sequence_steps ?? []).filter(s => s.id !== id))
  }

  const steps = [...(sequence.automation_sequence_steps ?? [])].sort((a, b) => a.step_order - b.step_order)

  return (
    <div className={`rounded-xl border p-4 ${sequence.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{sequence.name}</p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <GitBranch className="w-3 h-3" /> {triggerLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={sequence.is_active} onChange={onToggle} className="sr-only peer" />
            <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
          </label>
          <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const { label, icon: Icon } = ACTION_LABELS[step.action_type]
          const tplName = step.action_type === 'send_whatsapp_template'
            ? templates.find(t => t.id === step.action_config?.template_id)?.name ?? 'plantilla eliminada'
            : null
          return (
            <div key={step.id} className="flex items-center gap-2.5 text-xs bg-slate-50 rounded-lg px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 text-slate-700">
                {label}{tplName ? ` — "${tplName}"` : ''}{step.action_type === 'create_task' ? ` — "${step.action_config?.title}"` : ''}
              </span>
              <span className="text-slate-400 font-medium shrink-0">{formatDelay(step.delay_hours)}</span>
              <button onClick={() => removeStep(step.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>

      {showAddStep ? (
        <form onSubmit={addStep} className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Esperar (horas)</label>
              <input type="number" min={0} value={delayHours} onChange={e => setDelayHours(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Acción</label>
              <select value={actionType} onChange={e => setActionType(e.target.value as any)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full bg-white">
                {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {actionType === 'send_whatsapp_template' && (
            templates.length === 0 ? (
              <p className="text-[11px] text-amber-600">No hay plantillas de WhatsApp creadas todavía — creá una primero desde el chat de un deal.</p>
            ) : (
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full bg-white">
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )
          )}
          {actionType === 'create_task' && (
            <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título de la tarea"
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
          )}
          {(actionType === 'notify_owner' || actionType === 'notify_team') && (
            <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Mensaje de la notificación"
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || (actionType === 'send_whatsapp_template' && templates.length === 0)}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              Agregar paso
            </button>
            <button type="button" onClick={() => setShowAddStep(false)}
              className="text-xs font-semibold text-slate-500 px-3 py-1.5">Cancelar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAddStep(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3 h-3" /> Agregar paso
        </button>
      )}
    </div>
  )
}
