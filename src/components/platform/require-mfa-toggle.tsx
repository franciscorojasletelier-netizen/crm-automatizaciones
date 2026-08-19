'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function RequireMfaToggle({ orgId, requireMfa }: { orgId: string; requireMfa: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle(next: boolean) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/platform/organizations/${orgId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireMfa: next }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error desconocido'); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">Exigir doble factor</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ningún usuario de esta organización puede entrar sin 2FA activado.</p>
          </div>
        </div>
        <div className="relative inline-flex items-center shrink-0">
          <input type="checkbox" checked={requireMfa} disabled={saving}
            onChange={e => toggle(e.target.checked)}
            className="sr-only peer" />
          <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-indigo-600 peer-disabled:opacity-50 transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
        </div>
      </label>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
