'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { DOCUMENT_TYPE_LABEL, addDays, type DocumentType, type Invoice } from '@/lib/cobranza'
import { chileDateString } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { useDialog } from '@/lib/use-dialog'

export type Option = { id: string; label: string }

export interface InvoicePrefill {
  company_id?: string
  deal_id?: string
  project_id?: string
  quote_id?: string
  description?: string
  amount?: number
}

type Props = {
  companies: Option[]
  people: Option[]
  prefill?: InvoicePrefill
  /** Con invoice: edición. Sin invoice: creación. */
  invoice?: Pick<Invoice, 'id' | 'company_id' | 'document_type' | 'document_folio' | 'description' | 'amount' | 'paid_amount' | 'issue_date' | 'due_date' | 'responsible_id' | 'notes'>
  openInitially?: boolean
  triggerLabel?: string
}

export default function InvoiceForm({ companies, people, prefill, invoice, openInitially = false, triggerLabel }: Props) {
  const editing = !!invoice
  const today = chileDateString()
  const [open, setOpen] = useState(openInitially)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [form, setForm] = useState({
    company_id: invoice?.company_id ?? prefill?.company_id ?? '',
    document_type: (invoice?.document_type ?? 'factura') as DocumentType,
    document_folio: invoice?.document_folio ?? '',
    description: invoice?.description ?? prefill?.description ?? '',
    amount: invoice ? String(invoice.amount) : prefill?.amount ? String(Math.round(prefill.amount)) : '',
    issue_date: invoice?.issue_date ?? today,
    due_date: invoice?.due_date ?? addDays(today, 30),
    responsible_id: invoice?.responsible_id ?? '',
    notes: invoice?.notes ?? '',
  })
  const dialogRef = useDialog<HTMLFormElement>(open, () => setOpen(false), busy)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const amount = Math.round(Number(form.amount.replace(/\D/g, '')))
  const minAmount = invoice ? Number(invoice.paid_amount) : 1

  function validate(): string | null {
    if (!form.company_id) return 'Elige el cliente al que se cobra.'
    if (!form.description.trim()) return 'Describe qué se está cobrando.'
    if (!amount || amount < 1) return 'Ingresa un monto mayor a cero.'
    if (amount < minAmount) return `El monto no puede quedar bajo lo ya pagado (${formatCLP(minAmount)}).`
    if (form.due_date < form.issue_date) return 'El vencimiento no puede ser anterior a la emisión.'
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    const supabase = createClient()
    const payload = {
      company_id: form.company_id,
      document_type: form.document_type,
      document_folio: form.document_folio.trim() || null,
      description: form.description.trim(),
      amount,
      issue_date: form.issue_date,
      due_date: form.due_date,
      responsible_id: form.responsible_id || null,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('invoices').update(payload).eq('id', invoice!.id)
      setBusy(false)
      if (err) { setError(err.message); return }
      setOpen(false)
      router.refresh()
    } else {
      const { data, error: err } = await supabase.from('invoices').insert({
        ...payload,
        deal_id: prefill?.deal_id ?? null,
        project_id: prefill?.project_id ?? null,
        quote_id: prefill?.quote_id ?? null,
      }).select('id').single()
      setBusy(false)
      if (err || !data) { setError(err?.message ?? 'No se pudo crear el documento.'); return }
      router.push(`/cobranza/${data.id}`)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(''); setOpen(true) }} className={editing ? buttonClass.secondary : buttonClass.primary}>
        {editing ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
        {triggerLabel ?? (editing ? 'Editar' : 'Nuevo documento')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="invoice-form-title">
          <div className="absolute inset-0 bg-slate-900/30" onClick={busy ? undefined : () => setOpen(false)} />
          <form ref={dialogRef} tabIndex={-1} onSubmit={submit} className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200 outline-none">
            <header className="flex items-center justify-between px-5 h-14 border-b border-slate-200 shrink-0">
              <h2 id="invoice-form-title" className="text-base font-semibold text-slate-900">
                {editing ? 'Editar documento' : 'Nuevo documento por cobrar'}
              </h2>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Cerrar"
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label htmlFor="inv-company" className={labelClass}>Cliente</label>
                <select id="inv-company" value={form.company_id} onChange={set('company_id')} className={inputClass} required>
                  <option value="">Selecciona una empresa…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-type" className={labelClass}>Tipo</label>
                  <select id="inv-type" value={form.document_type} onChange={set('document_type')} className={inputClass}>
                    {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="inv-folio" className={labelClass}>Folio SII <span className="font-normal text-slate-400">(opcional)</span></label>
                  <input id="inv-folio" value={form.document_folio} onChange={set('document_folio')} className={inputClass} placeholder="Ej. 1043" maxLength={40} />
                </div>
              </div>

              <div>
                <label htmlFor="inv-desc" className={labelClass}>Concepto</label>
                <input id="inv-desc" value={form.description} onChange={set('description')} className={inputClass}
                  placeholder="Ej. Implementación flujo de ventas — hito 1" maxLength={200} required />
              </div>

              <div>
                <label htmlFor="inv-amount" className={labelClass}>Monto total (CLP, IVA incluido)</label>
                <input id="inv-amount" inputMode="numeric" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d]/g, '') }))}
                  className={`${inputClass} tabular-nums`} placeholder="0" required />
                {amount > 0 && <p className="mt-1 text-xs text-slate-500 tabular-nums">{formatCLP(amount)}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-issue" className={labelClass}>Emisión</label>
                  <input id="inv-issue" type="date" value={form.issue_date} onChange={set('issue_date')} className={inputClass} required />
                </div>
                <div>
                  <label htmlFor="inv-due" className={labelClass}>Vencimiento</label>
                  <input id="inv-due" type="date" value={form.due_date} min={form.issue_date} onChange={set('due_date')} className={inputClass} required />
                </div>
              </div>
              <div className="flex gap-1.5 -mt-2">
                {[0, 15, 30, 45, 60].map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, due_date: addDays(f.issue_date, d) }))}
                    className="h-6 px-2 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50">
                    {d === 0 ? 'Contado' : `${d} días`}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="inv-resp" className={labelClass}>Responsable de cobranza</label>
                <select id="inv-resp" value={form.responsible_id} onChange={set('responsible_id')} className={inputClass}>
                  <option value="">Sin asignar (lo gestiona finanzas)</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="inv-notes" className={labelClass}>Notas internas <span className="font-normal text-slate-400">(opcional)</span></label>
                <textarea id="inv-notes" value={form.notes} onChange={set('notes')} rows={3} maxLength={2000}
                  className={`${inputClass} h-auto py-2 resize-none`} placeholder="Condiciones de pago, orden de compra, contacto de pago…" />
              </div>

              {error && <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
            </div>

            <footer className="flex items-center justify-end gap-2 px-5 h-16 border-t border-slate-200 shrink-0">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className={buttonClass.secondary}>Cancelar</button>
              <button type="submit" disabled={busy} className={buttonClass.primary}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear documento'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  )
}
