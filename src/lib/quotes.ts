// Totales de una cotización. Una sola implementación para el panel del
// deal, la vista imprimible, la página pública del cliente y la cobranza.
// Subtotal e impuestos se redondean al peso (CLP) o al centavo (USD/EUR),
// como en un documento tributario, para que el total que acepta el cliente
// sea el mismo que después se cobra. Cada impuesto se calcula sobre el
// subtotal (p. ej. IVA 19 % + impuesto adicional 10 %).

import { normalizeTaxes, roundMoney, type Tax } from '@/lib/money'

export interface QuoteItem { description: string; quantity: number; unit_price: number }

/** Cotización como documento (vista imprimible y página pública). */
export interface QuoteDoc {
  quote_number: number; status: string; items: QuoteItem[] | null; tax_rate: number; notes: string | null
  taxes?: Tax[] | null; currency?: string | null
  created_at: string; valid_until: string | null
  public_token?: string | null
  accepted_at: string | null; rejected_at: string | null
  accepted_by_name?: string | null; accepted_ip?: string | null
}
export interface QuoteDeal {
  companies: { name: string | null; industry?: string | null } | null
  contacts: { full_name: string | null; email: string | null } | null
}
export interface QuoteOrg { name: string; display_name: string | null; phone: string | null; email: string | null; address: string | null; logo_url?: string | null }

export interface TaxLine extends Tax { amount: number }

/**
 * @param taxes lista de impuestos, o la tasa única de cotizaciones antiguas.
 */
export function quoteTotals(items: QuoteItem[] | null | undefined, taxes: Tax[] | number | null | undefined, currency?: string | null) {
  const list = typeof taxes === 'number' || taxes == null ? normalizeTaxes(null, taxes) : normalizeTaxes(taxes)
  const subtotal = roundMoney((items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0), currency)
  const taxLines: TaxLine[] = list.map(t => ({ ...t, amount: roundMoney(subtotal * ((Number(t.rate) || 0) / 100), currency) }))
  const tax = roundMoney(taxLines.reduce((s, t) => s + t.amount, 0), currency)
  return { subtotal, taxLines, tax, total: roundMoney(subtotal + tax, currency) }
}

/** Impuestos guardados en una cotización (o su tasa antigua). */
export function quoteTaxes(q: { taxes?: unknown; tax_rate?: number | null }): Tax[] {
  return q.taxes != null ? normalizeTaxes(q.taxes) : normalizeTaxes(null, q.tax_rate)
}
