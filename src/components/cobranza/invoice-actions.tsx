'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { ACTIVITY_LABEL, PAYMENT_METHOD_LABEL, addDays, type ActivityKind, type PaymentMethod } from '@/lib/cobranza'
import { chileDateString } from '@/lib/dates'
import { clp } from '@/lib/format'

function ErrorLine({ message }: { message: string }) {
  if (!message) return null
  return <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{message}</p>
}

// ── Registrar pago ────────────────────────────────────────────
export function PaymentForm({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const today = chileDateString()
  const [amount, setAmount] = useState(String(balance))
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('transferencia')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const value = Math.round(Number(amount.replace(/\D/g, '')))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!value || value < 1) { setError('Ingresa el monto pagado.'); return }
    if (value > balance) { setError(`El pago no puede superar el saldo (${clp(balance)}).`); return }
    if (paidOn > today) { setError('La fecha de pago no puede ser futura.'); return }
    setBusy(true); setError('')
    const { error: err } = await createClient().from('invoice_payments').insert({
      invoice_id: invoiceId, amount: value, paid_on: paidOn, method, reference: reference.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setReference('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pay-amount" className={labelClass}>Monto</label>
          <input id="pay-amount" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            className={`${inputClass} tabular-nums`} />
        </div>
        <div>
          <label htmlFor="pay-date" className={labelClass}>Fecha de pago</label>
          <input id="pay-date" type="date" value={paidOn} max={today} onChange={e => setPaidOn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pay-method" className={labelClass}>Medio</label>
          <select id="pay-method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pay-ref" className={labelClass}>Referencia</label>
          <input id="pay-ref" value={reference} onChange={e => setReference(e.target.value)} maxLength={80}
            className={inputClass} placeholder="N° operación, cheque…" />
        </div>
      </div>
      <ErrorLine message={error} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setAmount(String(balance))} className="text-[13px] text-accent-700 hover:underline">
          Pagar saldo completo ({clp(balance)})
        </button>
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Registrar pago
        </button>
      </div>
    </form>
  )
}

// ── Registrar gestión ─────────────────────────────────────────
export function ActivityForm({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const today = chileDateString()
  const [kind, setKind] = useState<ActivityKind>('llamada')
  const [notes, setNotes] = useState('')
  const [promiseDate, setPromiseDate] = useState(addDays(today, 7))
  const [promiseAmount, setPromiseAmount] = useState(String(balance))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const isPromise = kind === 'compromiso'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim()) { setError('Describe qué pasó en la gestión.'); return }
    if (isPromise && promiseDate < today) { setError('La fecha comprometida no puede ser pasada.'); return }
    setBusy(true); setError('')
    const amount = Math.round(Number(promiseAmount.replace(/\D/g, '')))
    const { error: err } = await createClient().from('invoice_activities').insert({
      invoice_id: invoiceId, kind, notes: notes.trim(),
      promise_date: isPromise ? promiseDate : null,
      promise_amount: isPromise && amount > 0 ? amount : null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setNotes('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de gestión">
        {(Object.keys(ACTIVITY_LABEL) as ActivityKind[]).map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={`h-7 px-2.5 rounded-md border text-[13px] transition-colors ${
              kind === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {ACTIVITY_LABEL[k]}
          </button>
        ))}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000} aria-label="Detalle de la gestión"
        className={`${inputClass} h-auto py-2 resize-none`}
        placeholder={isPromise ? 'Quién se comprometió y en qué condiciones…' : 'Con quién hablaste y qué respondió…'} />
      {isPromise && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="act-date" className={labelClass}>Pagará el</label>
            <input id="act-date" type="date" value={promiseDate} min={today} onChange={e => setPromiseDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="act-amount" className={labelClass}>Monto comprometido</label>
            <input id="act-amount" inputMode="numeric" value={promiseAmount} onChange={e => setPromiseAmount(e.target.value.replace(/[^\d]/g, ''))}
              className={`${inputClass} tabular-nums`} />
          </div>
        </div>
      )}
      <ErrorLine message={error} />
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={buttonClass.secondary}>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar gestión
        </button>
      </div>
    </form>
  )
}

// ── Eliminar pago (corrección de un error de digitación) ──────
export function DeletePaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function remove() {
    setBusy(true)
    const { error } = await createClient().from('invoice_payments').delete().eq('id', paymentId)
    setBusy(false)
    setConfirming(false)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <button onClick={remove} disabled={busy} className="text-xs font-medium text-red-700 hover:underline">
          {busy ? 'Eliminando…' : 'Eliminar'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-slate-500 hover:underline">Cancelar</button>
      </span>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} aria-label={`Eliminar pago ${label}`} title="Eliminar pago"
      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Anular documento ──────────────────────────────────────────
export function CancelInvoiceButton({ invoiceId, hasPayments }: { invoiceId: string; hasPayments: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function cancel() {
    if (reason.trim().length < 5) { setError('Indica el motivo de la anulación.'); return }
    setBusy(true); setError('')
    const { error: err } = await createClient().from('invoices')
      .update({ status: 'anulada', cancelled_reason: reason.trim() }).eq('id', invoiceId)
    setBusy(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    router.refresh()
  }

  if (hasPayments) {
    return (
      <button disabled title="Tiene pagos registrados: elimínalos primero para anular" className={buttonClass.ghost}>
        <Ban className="w-3.5 h-3.5" /> Anular
      </button>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass.ghost}>
        <Ban className="w-3.5 h-3.5" /> Anular
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="absolute inset-0 bg-slate-900/40" onClick={busy ? undefined : () => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-2xl border border-slate-200 p-5 space-y-3">
            <h2 id="cancel-title" className="text-base font-semibold text-slate-900">Anular documento</h2>
            <p className="text-sm text-slate-600">Deja de contar como deuda y no admite pagos. No se puede deshacer.</p>
            <div>
              <label htmlFor="cancel-reason" className={labelClass}>Motivo</label>
              <input id="cancel-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} autoFocus
                className={inputClass} placeholder="Ej. Emitido por error, reemplazado por nota de crédito" />
            </div>
            <ErrorLine message={error} />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} disabled={busy} className={buttonClass.secondary}>Volver</button>
              <button onClick={cancel} disabled={busy} className={buttonClass.danger}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Anular documento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
