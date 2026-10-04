'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { useCurrency } from '@/components/providers/currency-provider'

function EditableField({ label, value, fieldKey, dealId, type = 'text', prefix, emptyText }: {
  label: string; value: string | null; fieldKey: string; dealId: string; type?: string; prefix?: string
  /** Texto cuando no hay valor (p. ej. la probabilidad que se toma de la etapa). */
  emptyText?: string
}) {
  const currency = useCurrency()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const updateVal = type === 'number' ? (val === '' ? null : parseFloat(val)) : (val === '' ? null : val)
    if (type === 'number' && updateVal !== null && !Number.isFinite(updateVal as number)) { setSaving(false); setError('Ingresa un número válido.'); return }
    const { error: err } = await supabase.from('deals').update({ [fieldKey]: updateVal }).eq('id', dealId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setError('')
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          {prefix && <span className="text-sm font-semibold text-slate-400">{prefix}</span>}
          <input aria-label={label} type={type} value={val} onChange={e => setVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 text-sm border border-accent-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white" />
          <button aria-label="Guardar" onClick={save} disabled={saving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Cancelar" onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="group flex items-start justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">
          {value
            ? (prefix === '$' && type === 'number'
                ? formatMoney(value, currency)
                : `${prefix ?? ''}${type === 'number' ? Number(value).toLocaleString('es-CL') : value}`)
            : <span className="text-slate-500 font-normal text-xs">{emptyText ?? 'Sin valor'}</span>
          }
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${label.toLowerCase()}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent-50 text-slate-400 hover:text-accent-600 shrink-0 mt-0.5">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function DealEditFields({ deal, stageProbability }: {
  deal: { id: string; estimated_value: number | null; probability: number | null; next_action: string | null; source: string | null }
  /** Probabilidad por defecto de la etapa actual (se usa si el deal no tiene una propia). */
  stageProbability?: number | null
}) {
  return (
    <div className="divide-y divide-slate-100">
      <EditableField label="Valor estimado" value={deal.estimated_value?.toString() ?? null} fieldKey="estimated_value" dealId={deal.id} type="number" prefix="$" />
      {/* 0 = sin probabilidad propia (default de la columna): se usa la de la etapa, igual que en la cabecera. */}
      <EditableField label="Probabilidad (%)" value={deal.probability ? deal.probability.toString() : null} fieldKey="probability" dealId={deal.id} type="number"
        emptyText={stageProbability ? `Según la etapa (${stageProbability}%)` : 'Sin valor'} />
      <EditableField label="Próxima acción" value={deal.next_action} fieldKey="next_action" dealId={deal.id} />
      <EditableField label="Fuente" value={deal.source} fieldKey="source" dealId={deal.id} />
    </div>
  )
}
