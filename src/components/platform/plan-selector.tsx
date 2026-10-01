'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PLANS, type PlanKey } from '@/lib/plans'
import { cn } from '@/lib/utils'

export default function PlanSelector({ orgId, plan }: { orgId: string; plan: PlanKey }) {
  const [current, setCurrent] = useState<PlanKey>(plan)
  const [busy, setBusy] = useState<PlanKey | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function choose(next: PlanKey) {
    if (next === current || busy) return
    if (next !== 'personalizado' && !confirm(`Aplicar el plan ${PLANS[next].label}: cambia el límite de usuarios y los módulos de esta organización. ¿Continuar?`)) return
    setBusy(next); setError('')
    const res = await fetch(`/api/platform/organizations/${orgId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: next }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(data.error ?? 'No se pudo cambiar el plan'); return }
    setCurrent(next)
    router.refresh()
  }

  return (
    <section className="bg-card border border-slate-200 rounded-lg shadow-xs p-4">
      <h2 className="text-sm font-semibold text-slate-900">Plan</h2>
      <p className="text-xs text-slate-500 mt-0.5">Fija el límite de usuarios y los módulos. Después puedes ajustarlos a mano abajo.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
        {(Object.keys(PLANS) as PlanKey[]).map(k => (
          <button key={k} type="button" role="radio" aria-checked={current === k} onClick={() => choose(k)} disabled={!!busy}
            className={cn('text-left rounded-lg border px-3 py-2.5 transition-colors',
              current === k ? 'border-accent-400 bg-accent-50' : 'border-slate-200 hover:bg-slate-50')}>
            <span className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
              {busy === k && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{PLANS[k].label}
              {current === k && <span className="text-[11px] font-medium text-accent-700">· actual</span>}
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">{PLANS[k].description}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  )
}
