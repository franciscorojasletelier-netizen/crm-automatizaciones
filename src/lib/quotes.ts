// Totales de una cotización. Una sola implementación para el panel del
// deal, la vista imprimible, la página pública del cliente y la cobranza.
// CLP no tiene decimales: subtotal e IVA se redondean al peso, como en un
// documento tributario, para que el total que acepta el cliente sea el
// mismo que después se cobra.

export interface QuoteItem { description: string; quantity: number; unit_price: number }

export function quoteTotals(items: QuoteItem[] | null | undefined, taxRate: number) {
  const subtotal = Math.round((items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0))
  const tax = Math.round(subtotal * ((Number(taxRate) || 0) / 100))
  return { subtotal, tax, total: subtotal + tax }
}
