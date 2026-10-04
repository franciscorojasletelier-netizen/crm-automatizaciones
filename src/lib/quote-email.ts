// Correos del flujo de cotización, con la misma estructura que el estado de
// cuenta de cobranza (resumen en casillas, detalle en filas, botón):
//   1. La cotización al cliente (mensaje del ejecutivo + resumen + detalle
//      + plan de pagos + cómo aceptarla).
//   2. El código de un solo uso para firmar.
//   3. El comprobante de aceptación (a ambas partes).
// Versión HTML (plantilla común) + texto.
import { DATE_ONLY_TZ, CHILE_TZ } from '@/lib/dates'
import { money } from '@/lib/money'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import {
  emailButton, emailCallout, emailCode, emailHeading, emailParagraph, emailRows, emailShell, emailSmall, emailSummary,
  EMAIL_COLORS, EMAIL_FONT, type EmailBrand,
} from '@/lib/email-layout'
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

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'short', year: 'numeric' })
const todayLong = () => new Date().toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' })
const pct = (n: number) => `${n.toLocaleString('es-CL')} %`

const HOW_TO_ACCEPT = [
  'Cómo aceptarla: abre la cotización con el botón, elige «Aceptar» y completa tu nombre y RUT.',
  'Te enviaremos a este correo un código de 6 dígitos para firmar en línea y recibirás el comprobante de aceptación.',
].join('\n')

/** 1. La cotización al cliente. */
export function renderQuoteEmail({ quote, message, link, brand, subject }: {
  quote: QuoteForEmail; message: string; link: string; brand: EmailBrand; subject: string
}): { html: string; text: string } {
  const cur = quote.currency ?? 'CLP'
  const items = quote.items ?? []
  const { subtotal, taxLines, total } = quoteTotals(items, quoteTaxes(quote), cur)
  const terms = normalizePaymentTerms(quote.payment_terms)
  const schedule = terms ? paymentSchedule(terms, total, cur) : []
  const first = schedule[0]

  const paragraphs = message.replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const summary = emailSummary([
    { label: 'Total', value: money(total, cur) },
    ...(first && schedule.length > 1 ? [{ label: `Primera cuota (${pct(first.pct)})`, value: money(first.amount, cur) }] : []),
    { label: 'Válida hasta', value: quote.valid_until ? shortDate(quote.valid_until) : 'Sin fecha' },
  ])

  const detail = emailHeading('Detalle') + emailRows([
    ...items.map(i => ({ left: i.description, sub: `${i.quantity} × ${money(i.unit_price, cur)}`, right: money(i.quantity * i.unit_price, cur) })),
    { left: 'Subtotal', right: money(subtotal, cur), tone: 'muted' as const },
    ...taxLines.map(t => ({ left: `${t.label} (${pct(t.rate)})`, right: money(t.amount, cur), tone: 'muted' as const })),
    { left: 'Total', right: money(total, cur), tone: 'strong' as const },
  ])
  const payBlock = schedule.length
    ? emailHeading('Forma de pago')
      + emailRows(schedule.map((c, i) => ({ left: `Cuota ${i + 1} · ${c.label}`, sub: `${pct(c.pct)} del total`, right: money(c.amount, cur) })))
      + (quote.payment_conditions ? emailSmall(quote.payment_conditions) : '')
    : ''

  const content = paragraphs.map(emailParagraph).join('')
    + summary
    + emailButton(link, 'Ver y responder la cotización')
    + emailSmall(HOW_TO_ACCEPT)
    + detail
    + payBlock
    + (quote.notes ? emailHeading('Notas') + emailParagraph(quote.notes) : '')
    + emailButton(link, 'Ver y responder la cotización')

  const html = emailShell({
    subject, brand, content,
    preheader: `Cotización N° ${quote.quote_number} · Total ${money(total, cur)}${quote.valid_until ? ` · válida hasta el ${longDate(quote.valid_until)}` : ''}`,
    kicker: `Cotización N° ${quote.quote_number}\n${todayLong()}`,
    footerNote: 'La aceptación se firma en línea con tu nombre, RUT y un código enviado a tu correo (firma electrónica simple, Ley 19.799).',
  })

  const text = [
    message,
    '',
    `Cotización N° ${quote.quote_number} — Total ${money(total, cur)}${quote.valid_until ? ` (válida hasta el ${longDate(quote.valid_until)})` : ''}`,
    '',
    'Detalle:',
    ...items.map(i => `• ${i.description}: ${i.quantity} × ${money(i.unit_price, cur)} = ${money(i.quantity * i.unit_price, cur)}`),
    `Subtotal: ${money(subtotal, cur)}`,
    ...taxLines.map(t => `${t.label} (${pct(t.rate)}): ${money(t.amount, cur)}`),
    `Total: ${money(total, cur)}`,
    ...(schedule.length ? ['', 'Forma de pago:', ...schedule.map((c, i) => `• Cuota ${i + 1} — ${c.label}: ${pct(c.pct)} = ${money(c.amount, cur)}`), ...(quote.payment_conditions ? [quote.payment_conditions] : [])] : []),
    '',
    `Revisar y responder: ${link}`,
    HOW_TO_ACCEPT,
  ].join('\n')

  return { html, text }
}

/** 2. Código de un solo uso para aceptar una cotización. */
export function renderAcceptanceCodeEmail({ code, quoteNumber, minutes, brand, totalLabel }: {
  code: string; quoteNumber: number; minutes: number; brand: EmailBrand; totalLabel?: string | null
}) {
  const subject = `Código para aceptar la cotización N° ${quoteNumber}: ${code}`
  const content = emailParagraph(`Usa este código para firmar la aceptación de la cotización N° ${quoteNumber} de ${brand.name}${totalLabel ? ` (total ${totalLabel})` : ''}:`)
    + emailCallout(`<div style="font:700 32px/1.2 ${EMAIL_FONT};letter-spacing:6px;color:${EMAIL_COLORS.ink};text-align:center;">${escapeHtml(code)}</div>`)
    + emailSmall(`Vence en ${minutes} minutos y sirve una sola vez. Si no estás aceptando esta cotización, ignora este correo: nadie puede firmar sin este código.`)
  return {
    subject,
    html: emailShell({ subject, brand, content, kicker: `Cotización N° ${quoteNumber}\nCódigo de firma`, preheader: `Tu código es ${code} · vence en ${minutes} minutos` }),
    text: `Tu código para aceptar la cotización N° ${quoteNumber}${totalLabel ? ` (total ${totalLabel})` : ''}: ${code}\nVence en ${minutes} minutos y sirve una sola vez.`,
  }
}

/** 3. Comprobante de aceptación: se envía al cliente y a la empresa. */
export function renderAcceptanceCertificateEmail({ snapshot, hash, link, brand, invoiceNote }: {
  snapshot: AcceptanceSnapshot; hash: string; link: string; brand: EmailBrand; invoiceNote?: string | null
}) {
  const cur = snapshot.documento.moneda
  const a = snapshot.aceptacion
  const when = new Date(a.fecha).toLocaleString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const company = snapshot.cliente.empresa
  const first = snapshot.plan_de_pagos[0]
  const subject = `Comprobante de aceptación — Cotización N° ${snapshot.documento.numero}${company ? ` · ${company}` : ''}`

  const content = emailParagraph(`La cotización N° ${snapshot.documento.numero} de ${snapshot.proveedor} fue aceptada y firmada en línea${company ? ` en representación de ${company}` : ''}. Este correo es el comprobante para ambas partes.`)
    + emailSummary([
      { label: 'Total aceptado', value: money(snapshot.total, cur) },
      ...(first && snapshot.plan_de_pagos.length > 1 ? [{ label: `Primera cuota (${pct(first.porcentaje)})`, value: money(first.monto, cur) }] : []),
      { label: 'Firmada', value: new Date(a.fecha).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short', year: 'numeric' }) },
    ])
    + (invoiceNote ? emailCallout(emailParagraph(`Próximo paso: emitiremos la factura de la primera cuota en las próximas horas hábiles. ${invoiceNote}.`)) : '')
    + emailHeading('Firmado por')
    + emailRows([
      { left: 'Nombre', right: a.nombre },
      { left: 'RUT', right: a.rut },
      ...(a.cargo ? [{ left: 'Cargo', right: a.cargo }] : []),
      ...(company ? [{ left: 'Empresa', right: company }] : []),
      { left: 'Correo verificado', right: a.correo_verificado },
      { left: 'Fecha y hora', right: when },
    ])
    + emailHeading('Lo aceptado')
    + emailRows([
      ...snapshot.items.map(i => ({ left: i.descripcion, sub: `${i.cantidad} × ${money(i.precio_unitario, cur)}`, right: money(i.total, cur) })),
      ...snapshot.impuestos.map(t => ({ left: `${t.nombre} (${pct(t.tasa)})`, right: money(t.monto, cur), tone: 'muted' as const })),
      { left: 'Total', right: money(snapshot.total, cur), tone: 'strong' as const },
    ])
    + (snapshot.plan_de_pagos.length ? emailHeading('Plan de pagos') + emailRows(snapshot.plan_de_pagos.map(c => ({ left: `Cuota ${c.cuota} · ${c.hito}`, sub: `${pct(c.porcentaje)} del total`, right: money(c.monto, cur) }))) : '')
    + (snapshot.condiciones_de_pago ? emailSmall(snapshot.condiciones_de_pago) : '')
    + emailCallout(emailParagraph(`«${a.declaracion}»`))
    + emailButton(link, 'Ver comprobante completo')
    + emailSmall('Huella SHA-256 de la copia aceptada (permite verificar que no se modificó):')
    + emailCode(hash)

  return {
    subject,
    html: emailShell({ subject, brand, content, bar: EMAIL_COLORS.green, kicker: `Comprobante de aceptación\nCotización N° ${snapshot.documento.numero}`, footerNote: a.metodo }),
    text: [
      `Cotización N° ${snapshot.documento.numero} aceptada por ${a.nombre} (RUT ${a.rut})${company ? ` en representación de ${company}` : ''} el ${when}.`,
      `Total aceptado: ${money(snapshot.total, cur)}`,
      ...(invoiceNote ? [`Próximo paso: emitiremos la factura de la primera cuota en las próximas horas hábiles. ${invoiceNote}.`] : []),
      ...(snapshot.plan_de_pagos.length ? ['Plan de pagos:', ...snapshot.plan_de_pagos.map(c => `• Cuota ${c.cuota} — ${c.hito}: ${pct(c.porcentaje)} = ${money(c.monto, cur)}`)] : []),
      `Comprobante: ${link}`,
      `Huella SHA-256: ${hash}`,
    ].join('\n'),
  }
}
