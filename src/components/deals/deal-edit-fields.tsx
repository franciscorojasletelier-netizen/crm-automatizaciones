'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'

function EditableField({ label, value, fieldKey, dealId, type = 'text', prefix }: {
  label: string
  value: string | null
  fieldKey: string
  dealId: string
  type?: string
  prefix?: string
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
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
          <input
            type={type}
            value={val}
            onChange={e => setVal(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-gray-900"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start justify-between gap-2">
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value ? `${prefix ?? ''}${type === 'number' ? Number(value).toLocaleString() : value}` : <span className="text-gray-300 italic">Sin valor</span>}</p>
      </div>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 text-gray-400 hover:text-gray-700">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function DealEditFields({ deal }: { deal: any }) {
  return (
    <div className="space-y-2">
      <EditableField label="Valor estimado" value={deal.estimated_value?.toString() ?? null} fieldKey="estimated_value" dealId={deal.id} type="number" prefix="$" />
      <EditableField label="Probabilidad (%)" value={deal.probability?.toString() ?? null} fieldKey="probability" dealId={deal.id} type="number" />
      <EditableField label="Próxima acción" value={deal.next_action} fieldKey="next_action" dealId={deal.id} />
      <EditableField label="Fuente" value={deal.source} fieldKey="source" dealId={deal.id} />
    </div>
  )
}
