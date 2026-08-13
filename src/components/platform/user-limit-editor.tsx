'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

export default function UserLimitEditor({ orgId, currentUsers, maxUsers }: {
  orgId: string; currentUsers: number; maxUsers: number | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(maxUsers?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const parsed = value.trim() === '' ? null : parseInt(value, 10)
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setError('Tiene que ser un número entero mayor a 0, o vacío para sin límite')
      setSaving(false)
      return
    }
    const res = await fetch(`/api/platform/organizations/${orgId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxUsers: parsed }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error desconocido'); return }
    router.refresh()
  }

  const overLimit = maxUsers != null && currentUsers > maxUsers

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <Users className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-800">Límite de usuarios</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {currentUsers} usuario{currentUsers === 1 ? '' : 's'} activo{currentUsers === 1 ? '' : 's'} de la organización.
        {overLimit && <span className="text-red-600 font-semibold"> Ya superó el límite configurado.</span>}
      </p>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number" min={1} value={value} onChange={e => setValue(e.target.value)}
          placeholder="Sin límite"
          className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={save} disabled={saving}
          className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          Guardar
        </button>
        <span className="text-[10px] text-slate-400">Vacío = sin límite</span>
      </div>
    </div>
  )
}
