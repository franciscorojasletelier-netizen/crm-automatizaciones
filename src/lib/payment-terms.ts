// Plan de pagos por hitos de una cotización (p. ej. 50 % al inicio, 30 % al
// 70 % de avance, 20 % a la entrega). La organización define el plan por
// defecto y cada cotización guarda el suyo; siempre suma 100 %.
import { roundMoney } from '@/lib/money'

/**
 * at: avance del proyecto (0–100) que dispara la factura de la cuota.
 * 0 = al aceptar la cotización; 100 = a la entrega; null = se factura a mano.
 */
export interface PaymentTerm { label: string; pct: number; at?: number | null }
export interface PaymentInstallment extends PaymentTerm { amount: number }

export const DEFAULT_PAYMENT_TERMS: PaymentTerm[] = [
  { label: 'Al inicio', pct: 50, at: 0 },
  { label: 'Al 70 % de avance', pct: 30, at: 70 },
  { label: 'Entrega final (100 %)', pct: 20, at: 100 },
]

export const PAYMENT_PRESETS: { key: string; label: string; terms: PaymentTerm[] }[] = [
  { key: '50-30-20', label: '50 % inicio · 30 % al 70 % · 20 % final', terms: DEFAULT_PAYMENT_TERMS },
  { key: '50-50', label: '50 % inicio · 50 % al 70 %', terms: [{ label: 'Al inicio', pct: 50, at: 0 }, { label: 'Al 70 % de avance', pct: 50, at: 70 }] },
]

export const DEFAULT_PAYMENT_CONDITIONS = 'Cada cuota se factura al cumplirse su hito. El inicio del trabajo queda sujeto al pago de la primera cuota.'
export const MAX_PAYMENT_TERMS = 6

export function normalizePaymentTerms(raw: unknown): PaymentTerm[] | null {
  if (!Array.isArray(raw)) return null
  const list = raw
    .map((t, i) => {
      const label = String((t as PaymentTerm)?.label ?? '').trim()
      const rawAt = (t as PaymentTerm)?.at
      const at = rawAt === null ? null : rawAt !== undefined && Number.isFinite(Number(rawAt)) ? Number(rawAt) : inferTriggerAt(label, i)
      return { label, pct: Number((t as PaymentTerm)?.pct), at }
    })
    .filter(t => t.label && Number.isFinite(t.pct) && t.pct > 0)
  return list.length ? list : null
}

/** Para planes guardados sin disparador: se deduce del texto del hito. */
export function inferTriggerAt(label: string, index: number): number | null {
  if (index === 0) return 0
  const l = label.toLowerCase()
  const m = /(\d+)\s*%\s*(de\s*)?avance/.exec(l)
  if (m) return Math.min(100, Number(m[1]))
  if (/entrega|final/.test(l)) return 100
  return null
}

/** Texto corto del disparador: "al aceptar", "al 70 % de avance", "a la entrega", "manual". */
export function triggerLabel(at: number | null | undefined): string {
  if (at == null) return 'manual'
  if (at <= 0) return 'al aceptar'
  if (at >= 100) return 'a la entrega'
  return `al ${at} % de avance`
}

/** Mensaje de error o null si el plan es válido (mismo criterio que la base). */
export function paymentTermsError(terms: PaymentTerm[]): string | null {
  if (terms.length === 0) return 'Agrega al menos una cuota al plan de pagos.'
  if (terms.length > MAX_PAYMENT_TERMS) return `El plan de pagos admite hasta ${MAX_PAYMENT_TERMS} cuotas.`
  if (terms.some(t => !t.label.trim() || t.label.length > 80)) return 'Cada cuota necesita una descripción (hasta 80 caracteres).'
  if (terms.some(t => !Number.isFinite(t.pct) || t.pct <= 0 || t.pct > 100)) return 'Cada cuota debe tener un porcentaje mayor a 0.'
  const sum = Math.round(terms.reduce((s, t) => s + t.pct, 0) * 100) / 100
  if (terms.some(t => t.at != null && (!Number.isFinite(t.at) || t.at < 0 || t.at > 100))) return 'El avance que dispara cada cuota debe estar entre 0 y 100 %.'
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
