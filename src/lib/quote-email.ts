// Correo de cotización al cliente: mensaje del ejecutivo, resumen de la
// cotización (ítems, impuestos, total) y botón al link para aceptar o
// rechazar. Versión HTML (plantilla común) + texto.
import { DATE_ONLY_TZ, CHILE_TZ } from '@/lib/dates'
import { money } from '@/lib/money'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { emailButton, emailCallout, emailHeading, emailParagraph, emailRows, emailShell, EMAIL_COLORS, EMAIL_FONT, type EmailBrand } from '@/lib/email-layout'
import { escapeHtml } from '@/lib/html'
import { normalizePaymentTerms, paymentSchedule } from '@/lib/payment-terms'
import type { AcceptanceSnapshot } from '@/lib/quote-acceptance'

export interface QuoteForEmail {
  quote_number: number
  items: QuoteItem[] | null
  taxes?: unknown
  tax_rate?: number | null
  currency?: string | null
  valid_until: string | null
  notes: string | null
  payment_terms?: unknown
  payment_conditions?: string | null
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

  const terms = normalizePaymentTerms(quote.payment_terms)
  const schedule = terms ? paymentSchedule(terms, total, cur) : []
  const payBlock = schedule.length
    ? emailHeading('Forma de pago')
      + emailRows(schedule.map((c, i) => ({ left: `Cuota ${i + 1} · ${c.label}`, sub: `${c.pct.toLocaleString('es-CL')} % del total`, right: money(c.amount, cur) })))
      + (quote.payment_conditions ? emailParagraph(quote.payment_conditions) : '')
    : ''

  const content = paragraphs.map(emailParagraph).join('')
    + totalBlock
    + emailButton(link, 'Ver y responder la cotización')
    + detail
    + payBlock
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
    ...(schedule.length ? ['', 'Forma de pago:', ...schedule.map((c, i) => `• Cuota ${i + 1} (${c.label}, ${c.pct} %): ${money(c.amount, cur)}`), ...(quote.payment_conditions ? [quote.payment_conditions] : [])] : []),
    '',
    `Revisar y responder: ${link}`,
  ].join('\n')

  return { html, text }
}

/** Código de un solo uso para aceptar una cotización. */
export function renderAcceptanceCodeEmail({ code, quoteNumber, minutes, brand }: { code: string; quoteNumber: number; minutes: number; brand: EmailBrand }) {
  const subject = `Código para aceptar la cotización N° ${quoteNumber}: ${code}`
  const content = emailParagraph(`Usa este código para confirmar la aceptación de la cotización N° ${quoteNumber} de ${brand.name}:`)
    + emailCallout(`<div style="font:700 32px/1.2 ${EMAIL_FONT};letter-spacing:6px;color:${EMAIL_COLORS.ink};text-align:center;">${escapeHtml(code)}</div>`)
    + emailParagraph(`Vence en ${minutes} minutos. Si no estás aceptando una cotización, ignora este correo.`)
  return { subject, html: emailShell({ subject, brand, content, kicker: `Cotización N° ${quoteNumber}`, preheader: `Tu código es ${code}` }), text: `Tu código para aceptar la cotización N° ${quoteNumber}: ${code} (vence en ${minutes} minutos).` }
}

/** Comprobante de aceptación: se envía al cliente y a la empresa. */
export function renderAcceptanceCertificateEmail({ snapshot, hash, link, brand, invoiceNote }: { snapshot: AcceptanceSnapshot; hash: string; link: string; brand: EmailBrand; invoiceNote?: string | null }) {
  const cur = snapshot.documento.moneda
  const a = snapshot.aceptacion
  const when = new Date(a.fecha).toLocaleString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const subject = `Comprobante de aceptación — Cotización N° ${snapshot.documento.numero}`
  const content = emailParagraph(`La cotización N° ${snapshot.documento.numero} de ${snapshot.proveedor} fue aceptada. Este correo es el comprobante para ambas partes.`)
    + (invoiceNote ? emailCallout(emailParagraph(`Próximo paso: emitiremos la factura de la primera cuota en las próximas horas hábiles. ${invoiceNote}.`)) : '')
    + emailCallout(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:500 13px/1.4 ${EMAIL_FONT};color:${EMAIL_COLORS.muted};">Total aceptado</td>
        <td align="right" style="font:700 22px/1.2 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};white-space:nowrap;">${escapeHtml(money(snapshot.total, cur))}</td></tr></table>`)
    + emailHeading('Firmado por')
    + emailRows([
      { left: 'Nombre', right: a.nombre },
      { left: 'RUT', right: a.rut },
      ...(a.cargo ? [{ left: 'Cargo', right: a.cargo }] : []),
      ...(snapshot.cliente.empresa ? [{ left: 'Empresa', right: snapshot.cliente.empresa }] : []),
      { left: 'Correo verificado', right: a.correo_verificado },
      { left: 'Fecha y hora', right: when },
      { left: 'IP', right: a.ip },
    ])
    + (snapshot.plan_de_pagos.length ? emailHeading('Plan de pagos aceptado') + emailRows(snapshot.plan_de_pagos.map(c => ({ left: `Cuota ${c.cuota} · ${c.hito}`, sub: `${c.porcentaje.toLocaleString('es-CL')} %`, right: money(c.monto, cur) }))) : '')
    + (snapshot.condiciones_de_pago ? emailParagraph(snapshot.condiciones_de_pago) : '')
    + emailCallout(emailParagraph(`"${a.declaracion}"`))
    + emailButton(link, 'Ver comprobante completo')
    + `<div style="font:400 11px/1.5 ${EMAIL_FONT};color:${EMAIL_COLORS.muted};word-break:break-all;">Huella SHA-256 del documento aceptado: ${escapeHtml(hash)}</div>`
  return {
    subject,
    html: emailShell({ subject, brand, content, bar: EMAIL_COLORS.green, kicker: 'Comprobante de aceptación', footerNote: a.metodo }),
    text: [`Cotización N° ${snapshot.documento.numero} aceptada por ${a.nombre} (RUT ${a.rut}) el ${when}.`, `Total: ${money(snapshot.total, cur)}`, `Comprobante: ${link}`, `Huella SHA-256: ${hash}`].join('\n'),
  }
}
