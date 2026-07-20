'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'
import { formatCLP } from '@/lib/format'

function EditableField({ label, value, fieldKey, dealId, type = 'text', prefix }: {
  label: string; value: string | null; fieldKey: string; dealId: string; type?: string; prefix?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const updateVal = type === 'number' ? (val === '' ? null : parseFloat(val)) : (val === '' ? null : val)
    await supabase.from('deals').update({ [fieldKey]: updateVal }).eq('id', dealId)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          {prefix && <span className="text-sm font-semibold text-slate-400">{prefix}</span>}
          <input type={type} value={val} onChange={e => setVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <button onClick={save} disabled={saving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">
          {value
            ? (prefix === '$' && type === 'number'
                ? formatCLP(value)
                : `${prefix ?? ''}${type === 'number' ? Number(value).toLocaleString('es-CL') : value}`)
            : <span className="text-slate-300 font-normal italic text-xs">Sin valor</span>
          }
        </p>
      </div>
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shrink-0 mt-0.5">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function DealEditFields({ deal }: { deal: any }) {
  return (
    <div className="divide-y divide-slate-100">
      <EditableField label="Valor estimado" value={deal.estimated_value?.toString() ?? null} fieldKey="estimated_value" dealId={deal.id} type="number" prefix="$" />
      <EditableField label="Probabilidad (%)" value={deal.probability?.toString() ?? null} fieldKey="probability" dealId={deal.id} type="number" />
      <EditableField label="Próxima acción" value={deal.next_action} fieldKey="next_action" dealId={deal.id} />
      <EditableField label="Fuente" value={deal.source} fieldKey="source" dealId={deal.id} />
    </div>
  )
}
