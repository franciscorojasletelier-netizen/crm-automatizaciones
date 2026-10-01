// Totales de una cotización. Una sola implementación para el panel del
// deal, la vista imprimible, la página pública del cliente y la cobranza.
// CLP no tiene decimales: subtotal e IVA se redondean al peso, como en un
// documento tributario, para que el total que acepta el cliente sea el
// mismo que después se cobra.

export interface QuoteItem { description: string; quantity: number; unit_price: number }

/** Cotización como documento (vista imprimible y página pública). */
export interface QuoteDoc {
  quote_number: number; status: string; items: QuoteItem[] | null; tax_rate: number; notes: string | null
  created_at: string; valid_until: string | null
  accepted_at: string | null; rejected_at: string | null
  accepted_by_name?: string | null; accepted_ip?: string | null
}
export interface QuoteDeal {
  companies: { name: string | null; industry?: string | null } | null
  contacts: { full_name: string | null; email: string | null } | null
}
export interface QuoteOrg { name: string; display_name: string | null; phone: string | null; email: string | null; address: string | null }

export function quoteTotals(items: QuoteItem[] | null | undefined, taxRate: number) {
  const subtotal = Math.round((items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0))
  const tax = Math.round(subtotal * ((Number(taxRate) || 0) / 100))
  return { subtotal, tax, total: subtotal + tax }
}
