'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'

export interface ReminderSettingsValue {
  auto_reminders: boolean
  days_before: number
  on_due_date: boolean
  days_after: number[]
}

const MORA_OPTIONS = [3, 7, 15, 30, 45, 60, 90]

export default function ReminderSettingsForm({ organizationId, initial, canSend }: {
  organizationId: string
  initial: ReminderSettingsValue
  canSend: boolean
}) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  const toggleMora = (n: number) =>
    setV(prev => ({ ...prev, days_after: prev.days_after.includes(n) ? prev.days_after.filter(x => x !== n) : [...prev.days_after, n].sort((a, b) => a - b) }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (v.days_after.length > 6) { setMsg({ ok: false, text: 'Elige como máximo 6 hitos de mora.' }); return }
    setBusy(true); setMsg(null)
    const { error } = await createClient().from('collection_settings').upsert({
      organization_id: organizationId, ...v, updated_at: new Date().toISOString(),
    })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setMsg({ ok: true, text: v.auto_reminders ? 'Guardado. Los recordatorios salen cada mañana.' : 'Guardado. Los recordatorios están apagados.' })
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <button type="button" role="switch" aria-checked={v.auto_reminders}
        onClick={() => setV(p => ({ ...p, auto_reminders: !p.auto_reminders }))}
        className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors',
          v.auto_reminders ? 'border-accent-300 bg-accent-50' : 'border-slate-200 bg-card')}>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">Enviar recordatorios automáticos</p>
          <p className="text-xs text-slate-500">Un correo por cliente con su estado de cuenta, cada mañana, según los hitos de abajo.</p>
        </div>
        <span className={cn('w-9 h-5 rounded-full relative transition-colors shrink-0', v.auto_reminders ? 'bg-accent-600' : 'bg-slate-300')}>
          <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', v.auto_reminders ? 'left-[18px]' : 'left-0.5')} />
        </span>
      </button>

      {!canSend && v.auto_reminders && (
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Falta activar el correo del sistema (Resend). Mientras tanto no saldrá ningún recordatorio.
        </p>
      )}

      <div className={cn('grid gap-5 sm:grid-cols-2', !v.auto_reminders && 'opacity-60')}>
        <div>
          <label htmlFor="rs-before" className={labelClass}>Antes del vencimiento</label>
          <div className="flex items-center gap-2">
            <input id="rs-before" type="number" min={0} max={30} value={v.days_before}
              onChange={e => setV(p => ({ ...p, days_before: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))}
              className={cn(inputClass, 'w-20 tabular-nums')} />
            <span className="text-[13px] text-slate-600">días antes <span className="text-slate-400">(0 = no avisar)</span></span>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={v.on_due_date} onChange={e => setV(p => ({ ...p, on_due_date: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 accent-[var(--color-accent-600)]" />
            Avisar el día del vencimiento
          </label>
        </div>
        <fieldset>
          <legend className={labelClass}>Con mora, a los</legend>
          <div className="flex flex-wrap gap-1.5">
            {MORA_OPTIONS.map(n => (
              <button key={n} type="button" aria-pressed={v.days_after.includes(n)} onClick={() => toggleMora(n)}
                className={cn('h-7 px-2.5 rounded-md border text-[13px] tabular-nums transition-colors',
                  v.days_after.includes(n) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                {n} días
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">El tono sube solo: aviso cordial, luego vencido y sobre 30 días, cobro firme.</p>
        </fieldset>
      </div>

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={cn('text-[13px] rounded-md px-3 py-2 border',
          msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200')}>
          {msg.text}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
        </button>
      </div>
    </form>
  )
}
