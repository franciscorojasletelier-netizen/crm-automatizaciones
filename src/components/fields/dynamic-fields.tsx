'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'
import type { FieldDefinition, FieldEntity } from '@/lib/fields'
import { formatFieldValue } from '@/lib/fields'

const TABLE_BY_ENTITY: Record<FieldEntity, string> = {
  deal: 'deals',
  company: 'companies',
  contact: 'contacts',
}

function toInputValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  return Array.isArray(v) ? v.join(',') : String(v)
}

function parseValue(field: FieldDefinition, raw: string | boolean | string[]): unknown {
  if (field.fieldType === 'boolean') return !!raw
  if (field.fieldType === 'multiselect') return Array.isArray(raw) ? raw : []
  if (field.fieldType === 'number' || field.fieldType === 'currency') {
    return raw === '' ? null : Number(raw)
  }
  return raw === '' ? null : raw
}

function FieldEditor({ field, entityId, entity, value, onSaved }: {
  field: FieldDefinition; entityId: string; entity: FieldEntity; value: unknown; onSaved: (v: unknown) => void
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState<any>(field.fieldType === 'boolean' ? !!value : (field.fieldType === 'multiselect' ? (Array.isArray(value) ? value : []) : toInputValue(value)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function save() {
    if (field.isRequired && (raw === '' || raw === null || (Array.isArray(raw) && raw.length === 0))) {
      setError('Este campo es obligatorio')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const parsed = parseValue(field, raw)

    // custom_fields es un jsonb — merge server-side para no pisar otros
    // campos que se hayan guardado en paralelo. Se lee y escribe en un solo
    // round trip usando el operador de Postgres directamente no es posible
    // vía PostgREST, así que se hace read-modify-write acotado a esta fila.
    const { data: current } = await supabase
      .from(TABLE_BY_ENTITY[entity]).select('custom_fields').eq('id', entityId).single()
    const nextFields = { ...(current?.custom_fields ?? {}), [field.key]: parsed }

    const { error: err } = await supabase
      .from(TABLE_BY_ENTITY[entity]).update({ custom_fields: nextFields }).eq('id', entityId)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(parsed)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    const display = formatFieldValue(field, value)
    return (
      <div className="group flex items-start justify-between gap-2 py-1">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{field.label}</p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">
            {display || <span className="text-slate-300 font-normal italic text-xs">Sin valor</span>}
          </p>
        </div>
        <button onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shrink-0 mt-0.5">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
        {field.label}{field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <div className="flex items-start gap-1.5">
        <div className="flex-1">
          {field.fieldType === 'textarea' && (
            <textarea value={raw} onChange={e => setRaw(e.target.value)} autoFocus rows={2}
              placeholder={field.placeholder ?? ''}
              className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          )}
          {(field.fieldType === 'text' || field.fieldType === 'number' || field.fieldType === 'currency' || field.fieldType === 'date') && (
            <input
              type={field.fieldType === 'number' || field.fieldType === 'currency' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
              value={raw} onChange={e => setRaw(e.target.value)} autoFocus
              placeholder={field.placeholder ?? ''}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          )}
          {field.fieldType === 'select' && (
            <select value={raw} onChange={e => setRaw(e.target.value)} autoFocus
              className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="">— Seleccionar —</option>
              {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {field.fieldType === 'multiselect' && (
            <div className="flex flex-wrap gap-1.5">
              {field.options.map(o => {
                const checked = (raw as string[]).includes(o.value)
                return (
                  <button key={o.value} type="button"
                    onClick={() => setRaw((prev: string[]) => checked ? prev.filter(v => v !== o.value) : [...prev, o.value])}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      checked ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          )}
          {field.fieldType === 'boolean' && (
            <button type="button" onClick={() => setRaw((prev: boolean) => !prev)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                raw ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
              {raw ? 'Sí' : 'No'}
            </button>
          )}
          {field.helpText && <p className="text-[10px] text-slate-400 mt-1">{field.helpText}</p>}
          {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
        </div>
        <button onClick={save} disabled={saving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Renderiza los campos personalizados de una organización para una entidad
 * (deal/company/contact). Si la organización no definió ninguno, no
 * renderiza nada — no hay sección vacía que mostrar.
 */
export default function DynamicFields({ entity, entityId, fields, values }: {
  entity: FieldEntity
  entityId: string
  fields: FieldDefinition[]
  values: Record<string, unknown>
}) {
  const [current, setCurrent] = useState(values ?? {})
  if (fields.length === 0) return null

  return (
    <div className="divide-y divide-slate-100">
      {fields.map(f => (
        <FieldEditor
          key={f.id}
          field={f}
          entity={entity}
          entityId={entityId}
          value={current[f.key]}
          onSaved={v => setCurrent(prev => ({ ...prev, [f.key]: v }))}
        />
      ))}
    </div>
  )
}
