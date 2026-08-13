'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { FieldDefinition, FieldEntity, FieldType } from '@/lib/fields'

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto', textarea: 'Texto largo', number: 'Número', currency: 'Moneda',
  date: 'Fecha', select: 'Lista (una opción)', multiselect: 'Lista (varias opciones)', boolean: 'Sí/No',
}

async function callApi(method: 'POST' | 'PATCH', body: any) {
  const res = await fetch('/api/platform/fields', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
  return data
}

export default function FieldsEditor({ orgId, entity, label, fields }: {
  orgId: string; entity: FieldEntity; label: string; fields: FieldDefinition[]
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const [newOptions, setNewOptions] = useState('') // "Casa,Departamento" -> [{value:'casa',label:'Casa'}, ...]

  async function run(id: string, fn: () => Promise<any>) {
    setBusy(id)
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function createField(e: React.FormEvent) {
    e.preventDefault()
    if (!newKey || !newLabel) return
    const needsOptions = newType === 'select' || newType === 'multiselect'
    const options = needsOptions
      ? newOptions.split(',').map(s => s.trim()).filter(Boolean).map(l => ({ value: l.toLowerCase().replace(/\s+/g, '_'), label: l }))
      : []
    if (needsOptions && options.length === 0) { setError('Agregá al menos una opción, separadas por coma'); return }

    await run('new', () => callApi('POST', {
      organizationId: orgId, entity, key: newKey, label: newLabel, fieldType: newType,
      options, sortOrder: fields.length,
    }))
    setShowNew(false)
    setNewKey(''); setNewLabel(''); setNewOptions(''); setNewType('text')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-800">{label}</h2>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nuevo campo
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showNew && (
        <form onSubmit={createField} className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Clave (técnica, inmutable)</label>
            <input value={newKey} onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="ej. metros_cuadrados" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-44" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nombre visible</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="ej. Metros cuadrados" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-44" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tipo</label>
            <select value={newType} onChange={e => setNewType(e.target.value as FieldType)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {(newType === 'select' || newType === 'multiselect') && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Opciones (separadas por coma)</label>
              <input value={newOptions} onChange={e => setNewOptions(e.target.value)}
                placeholder="Casa, Departamento, Oficina" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-56" />
            </div>
          )}
          <button type="submit" disabled={busy === 'new'} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50">
            Crear
          </button>
        </form>
      )}

      {fields.length === 0 && !showNew && (
        <p className="text-xs text-slate-400 italic">Sin campos personalizados todavía.</p>
      )}

      <div className="space-y-1.5">
        {fields.map(f => (
          <div key={f.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${f.isActive ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <div className="flex-1 min-w-0">
              <input
                defaultValue={f.label}
                onBlur={e => e.target.value !== f.label && run(f.id, () => callApi('PATCH', { fieldId: f.id, label: e.target.value }))}
                disabled={busy === f.id}
                className="text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1 w-full"
              />
              <p className="text-[10px] text-slate-400">{f.key} · {TYPE_LABELS[f.fieldType]}{f.isRequired ? ' · obligatorio' : ''}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={f.isActive} disabled={busy === f.id}
                onChange={e => run(f.id, () => callApi('PATCH', { fieldId: f.id, is_active: e.target.checked }))}
                className="sr-only peer" />
              <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
