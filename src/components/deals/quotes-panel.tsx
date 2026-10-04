'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { FileText, Plus, Trash2, Loader2, ExternalLink, Copy, Check, X, Mail } from 'lucide-react'
import { quoteTotals, quoteTaxes } from '@/lib/quotes'
import {
  CURRENCIES, MAX_TAXES, currencyDecimals, formatMoney, money, normalizeCurrency,
  parseMoneyInput, sanitizeMoneyInput, type Tax,
} from '@/lib/money'
import { useCurrency } from '@/components/providers/currency-provider'
import SendQuoteEmail from '@/components/deals/send-quote-email'

interface Item { description: string; quantity: number; unit_price: number }
interface Quote {
  id: string; quote_number: number; status: string; items: Item[]; tax_rate: number
  taxes?: Tax[] | null; currency?: string | null
  notes: string | null; valid_until: string | null; created_at: string; public_token: string | null
}
// En el formulario los números se editan como texto (vacío, coma decimal).
interface ItemDraft { description: string; quantity: string; price: string }
interface TaxDraft { label: string; rate: string }

const STATUS_STYLE: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-amber-100 text-amber-700',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', expired: 'Vencida',
}

const fieldClass = 'text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white'
const emptyItem = (): ItemDraft => ({ description: '', quantity: '1', price: '' })
const toTaxDrafts = (taxes: Tax[]): TaxDraft[] => taxes.map(t => ({ label: t.label, rate: String(t.rate).replace('.', ',') }))

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        navigator.clipboard.writeText(`${window.location.origin}/cotizacion/${token}`)
        setCopied(true); setTimeout(() => setCopied(false), 1500)
      }}
      title="Copiar enlace para el cliente" aria-label="Copiar enlace para el cliente"
      className="p-1.5 rounded-lg text-slate-400 hover:text-accent-600 hover:bg-accent-50 transition-colors shrink-0">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function QuotesPanel({ dealId, quotes: initialQuotes, canEdit, defaultTaxes, contactEmail, contactName, senderName, orgName }: {
  dealId: string; quotes: Quote[]; canEdit: boolean
  /** Impuestos por defecto de la organización (Configuración → Datos de la empresa). */
  defaultTaxes: Tax[]
  /** Para el correo de la cotización. */
  contactEmail?: string | null; contactName?: string | null; senderName?: string | null; orgName: string
}) {
  // Cotización recién guardada que se está enviando por correo.
  const [sending, setSending] = useState<Quote | null>(null)
  const orgCurrency = useCurrency()
  const [quotes, setQuotes] = useState(initialQuotes)
  const [showNew, setShowNew] = useState(false)
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [currency, setCurrency] = useState<string>(orgCurrency)
  const [taxes, setTaxes] = useState<TaxDraft[]>(toTaxDrafts(defaultTaxes))
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const decimals = currencyDecimals(currency)
  const parsedItems: Item[] = items.map(i => ({
    description: i.description.trim(),
    quantity: Number(i.quantity.replace(',', '.')) || 0,
    unit_price: parseMoneyInput(i.price, currency),
  }))
  const parsedTaxes: Tax[] = taxes.map(t => ({ label: t.label.trim(), rate: Number(t.rate.replace(',', '.')) }))
  const { subtotal, taxLines, total } = quoteTotals(parsedItems, parsedTaxes.filter(t => t.label && Number.isFinite(t.rate)), currency)

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  function updateTax(i: number, patch: Partial<TaxDraft>) {
    setTaxes(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }

  function resetForm() {
    setItems([emptyItem()]); setTaxes(toTaxDrafts(defaultTaxes)); setCurrency(orgCurrency)
    setNotes(''); setValidUntil(''); setError('')
  }

  // Se guarda como borrador; pasa a "enviada" recién cuando el correo sale.
  async function save(thenSend: boolean) {
    const cleanItems = parsedItems.filter(i => i.description)
    if (cleanItems.length === 0) { setError('Agrega al menos un ítem con descripción.'); return }
    if (cleanItems.some(i => i.quantity <= 0)) { setError('La cantidad de cada ítem debe ser mayor a cero.'); return }
    const badTax = parsedTaxes.find(t => !t.label || !Number.isFinite(t.rate) || t.rate < 0 || t.rate > 100)
    if (badTax) { setError('Cada impuesto necesita un nombre y una tasa entre 0 y 100 %.'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await createClient().from('quotes').insert({
      deal_id: dealId, status: 'draft', items: cleanItems, taxes: parsedTaxes, currency: normalizeCurrency(currency),
      notes: notes.trim() || null, valid_until: validUntil || null,
    }).select().single()
    setSaving(false)
    if (err) { setError(friendlyError(err.message)); return }
    setQuotes(prev => [data, ...prev])
    setShowNew(false)
    resetForm()
    if (thenSend) setSending(data)
    else router.refresh()
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Cotizaciones</h2>
        {canEdit && (
          <button type="button" onClick={() => { if (showNew) resetForm(); setShowNew(v => !v) }} aria-expanded={showNew}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent-600 hover:bg-accent-50 px-2.5 py-1.5 rounded-lg transition-colors">
            {showNew ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Nueva</>}
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showNew && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="space-y-2">
            <div className="hidden sm:flex gap-2 text-[11px] font-semibold text-slate-500 px-0.5">
              <span className="flex-1">Descripción</span><span className="w-16">Cant.</span><span className="w-28">Precio unitario</span><span className="w-3.5" />
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                <input aria-label={`Descripción del ítem ${i + 1}`} value={item.description} onChange={e => updateItem(i, { description: e.target.value })}
                  placeholder="Descripción" maxLength={300} className={`${fieldClass} w-full sm:w-auto sm:flex-1`} />
                <input aria-label={`Cantidad del ítem ${i + 1}`} inputMode="decimal" value={item.quantity}
                  onChange={e => updateItem(i, { quantity: e.target.value.replace(/[^\d,.]/g, '') })}
                  placeholder="Cant." className={`${fieldClass} w-16`} />
                <input aria-label={`Precio unitario del ítem ${i + 1}`} inputMode={decimals ? 'decimal' : 'numeric'} value={item.price}
                  onChange={e => updateItem(i, { price: sanitizeMoneyInput(e.target.value, currency) })}
                  placeholder={decimals ? '0,00' : '0'} className={`${fieldClass} w-28 tabular-nums`} />
                <button type="button" onClick={() => setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [emptyItem()])}
                  aria-label={`Quitar ítem ${i + 1}`} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems(prev => [...prev, emptyItem()])} className="text-xs font-semibold text-accent-600 hover:text-accent-800">+ Agregar ítem</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="quote-currency" className="block text-[11px] font-semibold text-slate-500 mb-1">Moneda</label>
              <select id="quote-currency" value={currency} onChange={e => setCurrency(e.target.value)} className={`${fieldClass} w-full`}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="quote-valid" className="block text-[11px] font-semibold text-slate-500 mb-1">Válida hasta</label>
              <input id="quote-valid" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={`${fieldClass} w-full`} />
            </div>
          </div>
          {currency !== orgCurrency && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
              Esta cotización va en {currency}; tu organización trabaja en {orgCurrency}. Al aceptarla, el cobro se crea en {orgCurrency} con el monto que ingreses.
            </p>
          )}

          <fieldset className="space-y-2 min-w-0">
            <legend className="text-[11px] font-semibold text-slate-500 mb-1">Impuestos <span className="font-normal">(cada uno sobre el subtotal)</span></legend>
            {taxes.length === 0 && <p className="text-xs text-slate-500">Sin impuestos (p. ej. exportación).</p>}
            {taxes.map((t, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input aria-label={`Nombre del impuesto ${i + 1}`} value={t.label} onChange={e => updateTax(i, { label: e.target.value })}
                  placeholder="IVA" maxLength={40} className={`${fieldClass} flex-1 min-w-0`} />
                <div className="relative w-24">
                  <input aria-label={`Tasa del impuesto ${i + 1} (%)`} inputMode="decimal" value={t.rate}
                    onChange={e => updateTax(i, { rate: e.target.value.replace(/[^\d,.]/g, '') })}
                    placeholder="19" className={`${fieldClass} w-full pr-6 tabular-nums`} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
                <button type="button" onClick={() => setTaxes(prev => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Quitar impuesto ${t.label || i + 1}`} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {taxes.length < MAX_TAXES && (
              <button type="button" onClick={() => setTaxes(prev => [...prev, { label: '', rate: '' }])} className="text-xs font-semibold text-accent-600 hover:text-accent-800">+ Agregar impuesto</button>
            )}
          </fieldset>

          <textarea aria-label="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)"
            className={`${fieldClass} w-full resize-none`} />

          <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-600 tabular-nums">
              <p>Subtotal: {money(subtotal, currency)}</p>
              {taxLines.map((t, i) => <p key={i}>{t.label} ({t.rate.toLocaleString('es-CL')} %): {money(t.amount, currency)}</p>)}
              <p className="font-bold text-slate-800">Total: {money(total, currency)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => save(false)} disabled={saving}
                className="text-xs font-semibold text-slate-600 border border-slate-200 bg-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                Guardar borrador
              </button>
              <button type="button" onClick={() => save(true)} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Mail className="w-3.5 h-3.5" /> Guardar y enviar por correo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {sending && (
        <SendQuoteEmail autoOpen quoteId={sending.id} quoteNumber={sending.quote_number}
          contactEmail={contactEmail} contactName={contactName} senderName={senderName} orgName={orgName}
          onSent={() => setQuotes(prev => prev.map(q => q.id === sending.id ? { ...q, status: 'sent' } : q))}
          onClose={() => { setSending(null); router.refresh() }} />
      )}

      {quotes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin cotizaciones todavía.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => {
            const { total: qTotal } = quoteTotals(q.items, quoteTaxes(q), q.currency)
            return (
              <Link key={q.id} href={`/leads/${dealId}/cotizacion/${q.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:border-accent-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Cotización #{q.quote_number}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">{formatMoney(qTotal, q.currency)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                  {q.public_token && <CopyLinkButton token={q.public_token} />}
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
