// Aceptación de cotizaciones con firma electrónica simple reforzada (Ley
// 19.799): correo verificado con código, datos de quien firma, condiciones
// de pago aceptadas expresamente y una copia exacta de lo aceptado con su
// huella SHA-256 (cualquier cambio posterior cambiaría la huella).
// Solo servidor (usa node:crypto).
import crypto from 'node:crypto'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { normalizePaymentTerms, paymentSchedule } from '@/lib/payment-terms'
import { acceptanceDeclaration } from '@/lib/quote-declaration'

export const CODE_TTL_MINUTES = 15
export const CODE_MAX_ATTEMPTS = 5

/** JSON con claves ordenadas: la misma copia produce siempre la misma huella. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export const sha256Hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

/** Código de 6 dígitos y su HMAC (la base nunca guarda el código). */
export function newCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}
export function hashCode(quoteId: string, code: string) {
  const key = process.env.SUPABASE_SECRET_KEY ?? ''
  return crypto.createHmac('sha256', key).update(`${quoteId}:${code}`).digest('hex')
}
export function sameHash(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

/** "an***@cordillera.cl" */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`
}

export interface QuoteRow {
  id: string; quote_number: number; items: QuoteItem[] | null; taxes?: unknown; tax_rate?: number | null
  currency?: string | null; valid_until: string | null; notes: string | null; created_at: string
  payment_terms?: unknown; payment_conditions?: string | null
}
export interface Signer { name: string; rut: string; role: string | null; email: string; ip: string; userAgent: string | null }
export interface BillingData { legalName: string; taxId: string; activity: string | null; address: string | null; billingEmail: string | null }

/** Copia exacta de lo aceptado: documento, montos, plan de pagos, condiciones y firmante. */
export function buildAcceptanceSnapshot({ quote, orgName, company, contact, signer, acceptedAt, billing = null }: {
  quote: QuoteRow; orgName: string; company: string | null; contact: string | null; signer: Signer; acceptedAt: string
  billing?: BillingData | null
}) {
  const currency = quote.currency ?? 'CLP'
  const items = quote.items ?? []
  const { subtotal, taxLines, total } = quoteTotals(items, quoteTaxes(quote), currency)
  const terms = normalizePaymentTerms(quote.payment_terms)
  return {
    documento: { tipo: 'Cotización', numero: quote.quote_number, emitida: quote.created_at, valida_hasta: quote.valid_until, moneda: currency },
    proveedor: orgName,
    cliente: { empresa: company, contacto: contact, ...(billing ? { facturacion: billing } : {}) },
    items: items.map(i => ({ descripcion: i.description, cantidad: i.quantity, precio_unitario: i.unit_price, total: i.quantity * i.unit_price })),
    impuestos: taxLines.map(t => ({ nombre: t.label, tasa: t.rate, monto: t.amount })),
    subtotal, total,
    plan_de_pagos: terms ? paymentSchedule(terms, total, currency).map((c, i) => ({ cuota: i + 1, hito: c.label, porcentaje: c.pct, monto: c.amount, avance: c.at ?? null })) : [],
    condiciones_de_pago: quote.payment_conditions ?? null,
    notas: quote.notes ?? null,
    aceptacion: {
      nombre: signer.name, rut: signer.rut, cargo: signer.role, correo_verificado: signer.email,
      fecha: acceptedAt, ip: signer.ip, navegador: signer.userAgent,
      declaracion: acceptanceDeclaration(quote.quote_number, company),
      metodo: 'Firma electrónica simple: correo verificado con código de un solo uso, datos del firmante y aceptación expresa (Ley 19.799).',
    },
  }
}
export type AcceptanceSnapshot = ReturnType<typeof buildAcceptanceSnapshot>
