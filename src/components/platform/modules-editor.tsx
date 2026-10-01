'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import type { NavSection } from '@/lib/roles'
import { cn } from '@/lib/utils'

export default function ModulesEditor({ orgId, sections, enabledByKey, expiresByKey = {} }: {
  orgId: string
  sections: NavSection[]
  // Fail-open: si la clave no aparece acá, está habilitada.
  enabledByKey: Record<string, boolean>
  /** Fecha (YYYY-MM-DD) en que vence el módulo, si se contrató por un plazo. */
  expiresByKey?: Record<string, string | null>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  async function patch(key: string, payload: Record<string, unknown>) {
    setBusy(key)
    setError('')
    try {
      const res = await fetch('/api/platform/modules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, moduleKey: key, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-card rounded-lg border border-slate-200 shadow-xs p-4">
      <h2 className="text-sm font-semibold text-slate-900">Módulos habilitados</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">Con fecha, el módulo se apaga solo al vencer (aparece en Plataforma → Servicios).</p>
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sections.map(s => {
          const enabled = enabledByKey[s.key] !== false
          const expires = expiresByKey[s.key] ?? null
          const expired = !!expires && expires < today
          return (
            <div key={s.key} className={cn('p-2.5 rounded-lg border', expired ? 'border-red-200 bg-red-50/40' : 'border-slate-200')}>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[13px] font-medium text-slate-800">{s.label}</span>
                <span className="relative inline-flex items-center shrink-0">
                  <input type="checkbox" checked={enabled} disabled={busy === s.key}
                    onChange={e => patch(s.key, { enabled: e.target.checked })}
                    className="sr-only peer" aria-label={`Habilitar ${s.label}`} />
                  <span className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
                  <span className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
                </span>
              </label>
              {enabled && (
                editingDate === s.key ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input type="date" defaultValue={expires ?? ''} aria-label={`Vencimiento de ${s.label}`}
                      onChange={e => { setEditingDate(null); patch(s.key, { expiresOn: e.target.value || null }) }}
                      className="h-7 px-2 rounded-md border border-slate-300 text-xs bg-card" />
                    {expires && (
                      <button type="button" onClick={() => { setEditingDate(null); patch(s.key, { expiresOn: null }) }}
                        className="text-xs text-slate-500 hover:text-slate-900">Sin vencimiento</button>
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingDate(s.key)}
                    className={cn('mt-1 inline-flex items-center gap-1 text-xs', expired ? 'text-red-700 font-medium' : expires ? 'text-amber-800' : 'text-slate-500 hover:text-slate-800')}>
                    <CalendarClock className="w-3 h-3" />
                    {expires ? `${expired ? 'Venció' : 'Vence'} el ${expires.split('-').reverse().join('-')}` : 'Sin vencimiento'}
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
