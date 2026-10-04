// Correo de cotización al cliente: mensaje del ejecutivo, resumen de la
// cotización (ítems, impuestos, total) y botón al link para aceptar o
// rechazar. Versión HTML (plantilla común) + texto.
import { DATE_ONLY_TZ, CHILE_TZ } from '@/lib/dates'
import { money } from '@/lib/money'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { emailButton, emailCallout, emailHeading, emailParagraph, emailRows, emailShell, EMAIL_COLORS, EMAIL_FONT, type EmailBrand } from '@/lib/email-layout'
import { escapeHtml } from '@/lib/html'

export interface QuoteForEmail {
  quote_number: number
  items: QuoteItem[] | null
  taxes?: unknown
  tax_rate?: number | null
  currency?: string | null
  valid_until: string | null
  notes: string | null
}

export function defaultQuoteMessage({ contactName, senderName, orgName, quoteNumber }: {
  contactName?: string | null; senderName?: string | null; orgName: string; quoteNumber: number
}) {
  const first = contactName?.trim().split(/\s+/)[0]
  const who = senderName ? `, soy ${senderName.split(/\s+/)[0]} de ${orgName}` : `, te escribimos de ${orgName}`
  return `${first ? `Hola ${first}` : 'Hola'}${who}.\n\nTe envío la cotización N° ${quoteNumber}. Desde el botón puedes revisarla completa y aceptarla o rechazarla en línea.\n\nQuedo atento a cualquier duda.`
}

export function renderQuoteEmail({ quote, message, link, brand, subject }: {
  quote: QuoteForEmail; message: string; link: string; brand: EmailBrand; subject: string
}): { html: string; text: string } {
  const cur = quote.currency ?? 'CLP'
  const items = quote.items ?? []
  const { subtotal, taxLines, total } = quoteTotals(items, quoteTaxes(quote), cur)
  const validUntil = quote.valid_until
    ? new Date(`${quote.valid_until}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const today = new Date().toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' })

  const paragraphs = message.replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const totalBlock = emailCallout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:500 13px/1.4 ${EMAIL_FONT};color:${EMAIL_COLORS.muted};">Total cotización N° ${quote.quote_number}${validUntil ? `<br>Válida hasta el ${escapeHtml(validUntil)}` : ''}</td>
      <td align="right" style="font:700 22px/1.2 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};white-space:nowrap;">${escapeHtml(money(total, cur))}</td>
    </tr></table>`)

  const detail = emailHeading('Detalle') + emailRows([
    ...items.map(i => ({ left: i.description, sub: `${i.quantity} × ${money(i.unit_price, cur)}`, right: money(i.quantity * i.unit_price, cur) })),
    { left: 'Subtotal', right: money(subtotal, cur) },
    ...taxLines.map(t => ({ left: `${t.label} (${t.rate.toLocaleString('es-CL')} %)`, right: money(t.amount, cur) })),
    { left: 'Total', right: money(total, cur), tone: 'strong' as const },
  ])

  const content = paragraphs.map(emailParagraph).join('')
    + totalBlock
    + emailButton(link, 'Ver y responder la cotización')
    + detail
    + (quote.notes ? emailHeading('Notas') + emailParagraph(quote.notes) : '')

  const html = emailShell({
    subject, brand, content,
    preheader: `Cotización N° ${quote.quote_number} · Total ${money(total, cur)}`,
    kicker: `Cotización N° ${quote.quote_number}\n${today}`,
    footerNote: 'Puedes aceptar o rechazar la cotización desde el botón; queda registrado tu nombre y la fecha.',
  })

  const text = [
    message,
    '',
    `Cotización N° ${quote.quote_number} — Total ${money(total, cur)}${validUntil ? ` (válida hasta el ${validUntil})` : ''}`,
    ...items.map(i => `• ${i.description}: ${i.quantity} × ${money(i.unit_price, cur)} = ${money(i.quantity * i.unit_price, cur)}`),
    `Subtotal: ${money(subtotal, cur)}`,
    ...taxLines.map(t => `${t.label} (${t.rate} %): ${money(t.amount, cur)}`),
    `Total: ${money(total, cur)}`,
    '',
    `Revisar y responder: ${link}`,
  ].join('\n')

  return { html, text }
}
