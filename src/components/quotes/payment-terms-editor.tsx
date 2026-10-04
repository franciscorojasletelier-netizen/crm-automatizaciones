'use client'

// Editor del plan de pagos por hitos (cuotas que suman 100 %) y del texto
// de condiciones. Lo usan el formulario de cotización y Configuración.

import { Trash2 } from 'lucide-react'
import { MAX_PAYMENT_TERMS, PAYMENT_PRESETS, paymentTermsError, type PaymentTerm } from '@/lib/payment-terms'

export interface PaymentTermDraft { label: string; pct: string }

export const toPaymentDrafts = (terms: PaymentTerm[]): PaymentTermDraft[] =>
  terms.map(t => ({ label: t.label, pct: String(t.pct).replace('.', ',') }))

export const parsePaymentDrafts = (drafts: PaymentTermDraft[]): PaymentTerm[] =>
  drafts.map(d => ({ label: d.label.trim(), pct: Number(d.pct.replace(',', '.')) }))

export default function PaymentTermsEditor({ terms, onTerms, conditions, onConditions, idPrefix, fieldClass }: {
  terms: PaymentTermDraft[]
  onTerms: (t: PaymentTermDraft[]) => void
  conditions: string
  onConditions: (v: string) => void
  idPrefix: string
  fieldClass: string
}) {
  const parsed = parsePaymentDrafts(terms)
  const sum = Math.round(parsed.reduce((s, t) => s + (Number.isFinite(t.pct) ? t.pct : 0), 0) * 100) / 100
  const error = paymentTermsError(parsed)
  const update = (i: number, patch: Partial<PaymentTermDraft>) => onTerms(terms.map((t, k) => k === i ? { ...t, ...patch } : t))

  return (
    <fieldset className="space-y-2 min-w-0">
      <legend className="text-[11px] font-semibold text-slate-500 mb-1">Plan de pagos</legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Planes frecuentes">
        {PAYMENT_PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => onTerms(toPaymentDrafts(p.terms))}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            {p.label}
          </button>
        ))}
      </div>
      {terms.map((t, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input aria-label={`Hito de la cuota ${i + 1}`} value={t.label} maxLength={80} placeholder="Al inicio"
            onChange={e => update(i, { label: e.target.value })} className={`${fieldClass} flex-1 min-w-0`} />
          <div className="relative w-20 shrink-0">
            <input aria-label={`Porcentaje de la cuota ${i + 1}`} inputMode="decimal" value={t.pct} placeholder="50"
              onChange={e => update(i, { pct: e.target.value.replace(/[^\d,.]/g, '') })} className={`${fieldClass} w-full pr-6 tabular-nums`} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
          </div>
          <button type="button" onClick={() => onTerms(terms.filter((_, k) => k !== i))} aria-label={`Quitar cuota ${i + 1}`}
            className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        {terms.length < MAX_PAYMENT_TERMS
          ? <button type="button" onClick={() => onTerms([...terms, { label: '', pct: '' }])} className="text-xs font-semibold text-accent-600 hover:text-accent-800">+ Agregar cuota</button>
          : <span />}
        <span className={`text-[11px] tabular-nums ${sum === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>Suma: {sum.toLocaleString('es-CL')} %</span>
      </div>
      {error && terms.length > 0 && sum !== 100 && <p className="text-[11px] text-amber-700">{error}</p>}
      <div>
        <label htmlFor={`${idPrefix}-conditions`} className="block text-[11px] font-semibold text-slate-500 mb-1">Condiciones de pago</label>
        <textarea id={`${idPrefix}-conditions`} value={conditions} onChange={e => onConditions(e.target.value)} rows={2} maxLength={2000}
          className={`${fieldClass} w-full resize-y`} />
      </div>
    </fieldset>
  )
}
