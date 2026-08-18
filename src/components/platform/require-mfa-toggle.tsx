'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2 } from 'lucide-react'

export default function RequireMfaToggle({ orgId, requireMfa }: { orgId: string; requireMfa: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/platform/organizations/${orgId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireMfa: !requireMfa }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error desconocido'); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">Exigir doble factor</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ningún usuario de esta organización puede entrar sin 2FA activado.</p>
          </div>
        </div>
        <button
          onClick={toggle} disabled={saving}
          aria-pressed={requireMfa}
          className={`shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${requireMfa ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white absolute top-1.5 left-1.5" />
          ) : (
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${requireMfa ? 'translate-x-6' : 'translate-x-1'}`} />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
