'use client'

// Solicitudes de factura del negocio: a quién se enviaron y, si no hay
// contador registrado, el botón para mandarle los datos por correo.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, Receipt } from 'lucide-react'
import { money } from '@/lib/money'

export interface BillingRequestItem {
  id: string; installment: number; installments: number; label: string | null
  amount: number; currency: string; status: string; sent_to: string[] | null
}

export default function BillingRequests({ requests, defaultEmail }: { requests: BillingRequestItem[]; defaultEmail: string | null }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [to, setTo] = useState(defaultEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  if (requests.length === 0) return null

  async function send(id: string) {
    setBusy(true); setError('')
    const res = await fetch('/api/billing/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, to: to.trim() }) })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error ?? 'No se pudo enviar'); return }
    setOpenId(null)
    router.refresh()
  }

  return (
    <div className="border-t border-slate-100">
      <p className="px-4 pt-3 text-[12px] font-semibold text-slate-600 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Solicitudes de factura</p>
      <ul className="divide-y divide-slate-100">
        {requests.map(r => (
          <li key={r.id} className="px-4 py-2.5 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-slate-700">
                Cuota {r.installment}{r.installments > 1 ? ` de ${r.installments}` : ''}{r.label ? ` · ${r.label}` : ''} — <span className="tabular-nums">{money(r.amount, r.currency)}</span>
              </span>
              {r.status === 'sent'
                ? <span className="text-[11px] text-emerald-700">Enviada a {r.sent_to?.join(', ')}</span>
                : r.status === 'pending'
                  ? <span className="text-[11px] text-slate-500">Enviando…</span>
                  : (
                    <button type="button" onClick={() => { setOpenId(openId === r.id ? null : r.id); setError('') }}
                      className="text-[12px] font-semibold text-accent-700 hover:underline">
                      Enviar al contador
                    </button>
                  )}
            </div>
            {r.status === 'no_recipient' && openId !== r.id && (
              <p className="mt-0.5 text-[11px] text-amber-700">No hay contador registrado: envíale los datos de facturación por correo.</p>
            )}
            {openId === r.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor={`acc-${r.id}`} className="sr-only">Correo del contador</label>
                <input id={`acc-${r.id}`} type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="contador@estudio.cl"
                  className="flex-1 min-w-[12rem] text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
                <button type="button" onClick={() => send(r.id)} disabled={busy || !to.trim()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
                </button>
                {error && <p role="alert" className="basis-full text-xs text-red-600">{error}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
