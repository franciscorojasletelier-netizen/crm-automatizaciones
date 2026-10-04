// Plan de pagos por hitos de una cotización (p. ej. 50 % al inicio, 30 % al
// 70 % de avance, 20 % a la entrega). La organización define el plan por
// defecto y cada cotización guarda el suyo; siempre suma 100 %.
import { roundMoney } from '@/lib/money'

export interface PaymentTerm { label: string; pct: number }
export interface PaymentInstallment extends PaymentTerm { amount: number }

export const DEFAULT_PAYMENT_TERMS: PaymentTerm[] = [
  { label: 'Al inicio', pct: 50 },
  { label: 'Al 70 % de avance', pct: 30 },
  { label: 'Entrega final (100 %)', pct: 20 },
]

export const PAYMENT_PRESETS: { key: string; label: string; terms: PaymentTerm[] }[] = [
  { key: '50-30-20', label: '50 % inicio · 30 % al 70 % · 20 % final', terms: DEFAULT_PAYMENT_TERMS },
  { key: '50-50', label: '50 % inicio · 50 % al 70 %', terms: [{ label: 'Al inicio', pct: 50 }, { label: 'Al 70 % de avance', pct: 50 }] },
]

export const DEFAULT_PAYMENT_CONDITIONS = 'Cada cuota se factura al cumplirse su hito. El inicio del trabajo queda sujeto al pago de la primera cuota.'
export const MAX_PAYMENT_TERMS = 6

export function normalizePaymentTerms(raw: unknown): PaymentTerm[] | null {
  if (!Array.isArray(raw)) return null
  const list = raw
    .map(t => ({ label: String((t as PaymentTerm)?.label ?? '').trim(), pct: Number((t as PaymentTerm)?.pct) }))
    .filter(t => t.label && Number.isFinite(t.pct) && t.pct > 0)
  return list.length ? list : null
}

/** Mensaje de error o null si el plan es válido (mismo criterio que la base). */
export function paymentTermsError(terms: PaymentTerm[]): string | null {
  if (terms.length === 0) return 'Agrega al menos una cuota al plan de pagos.'
  if (terms.length > MAX_PAYMENT_TERMS) return `El plan de pagos admite hasta ${MAX_PAYMENT_TERMS} cuotas.`
  if (terms.some(t => !t.label.trim() || t.label.length > 80)) return 'Cada cuota necesita una descripción (hasta 80 caracteres).'
  if (terms.some(t => !Number.isFinite(t.pct) || t.pct <= 0 || t.pct > 100)) return 'Cada cuota debe tener un porcentaje mayor a 0.'
  const sum = Math.round(terms.reduce((s, t) => s + t.pct, 0) * 100) / 100
  if (sum !== 100) return `Las cuotas suman ${sum.toLocaleString('es-CL')} %; deben sumar 100 %.`
  return null
}

/** Montos de cada cuota; la última absorbe el redondeo para que sumen exactamente el total. */
export function paymentSchedule(terms: PaymentTerm[], total: number, currency?: string | null): PaymentInstallment[] {
  let acc = 0
  return terms.map((t, i) => {
    const amount = i === terms.length - 1 ? roundMoney(total - acc, currency) : roundMoney(total * t.pct / 100, currency)
    acc += amount
    return { ...t, amount }
  })
}
