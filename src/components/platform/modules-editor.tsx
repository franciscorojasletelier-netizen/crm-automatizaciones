'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { NavSection } from '@/lib/roles'

export default function ModulesEditor({ orgId, sections, enabledByKey }: {
  orgId: string
  sections: NavSection[]
  // Fail-open: si la clave no aparece acá, está habilitada.
  enabledByKey: Record<string, boolean>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggle(key: string, next: boolean) {
    setBusy(key)
    setError('')
    try {
      const res = await fetch('/api/platform/modules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, moduleKey: key, enabled: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-800 mb-3">Módulos habilitados</h2>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sections.map(s => {
          const enabled = enabledByKey[s.key] !== false
          return (
            <label key={s.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700">{s.label}</span>
              <div className="relative inline-flex items-center shrink-0">
                <input type="checkbox" checked={enabled} disabled={busy === s.key}
                  onChange={e => toggle(s.key, e.target.checked)}
                  className="sr-only peer" />
                <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
