// Correo de solicitud de factura al contador (plantilla común).
import { money } from '@/lib/money'
import { emailButton, emailCallout, emailHeading, emailParagraph, emailRows, emailShell, emailSmall, emailSummary, type EmailBrand } from '@/lib/email-layout'

export interface BillingClient {
  company: string | null
  legalName: string | null
  taxId: string | null
  activity: string | null
  address: string | null
  billingEmail: string | null
}

export interface BillingRequestData {
  quoteNumber: number
  installment: number
  installments: number
  label: string | null
  amount: number          // total de la cuota (impuestos incluidos)
  currency: string
  /** Proporción neta del total de la cotización (subtotal / total) para desglosar la cuota. */
  netRatio: number | null
  taxLines: { name: string; rate: number }[]
  signer: { name: string; rut: string } | null
  sellerName: string | null
}

/** Texto que va en el detalle de la factura. */
export function billingConcept(d: Pick<BillingRequestData, 'quoteNumber' | 'installment' | 'installments' | 'label'>) {
  return d.installments > 1
    ? `Cotización N° ${d.quoteNumber} — Cuota ${d.installment} de ${d.installments}${d.label ? ` (${d.label})` : ''}`
    : `Cotización N° ${d.quoteNumber}`
}

export function renderBillingRequestEmail({ data, client, brand, registerLink, certificateLink }: {
  data: BillingRequestData; client: BillingClient; brand: EmailBrand; registerLink: string; certificateLink: string | null
}) {
  const cur = data.currency
  const concept = billingConcept(data)
  const subject = `Solicitud de factura — ${client.legalName || client.company || 'Cliente'} · ${money(data.amount, cur)}`
  const net = data.netRatio != null ? Math.round(data.amount * data.netRatio * (cur === 'CLP' ? 1 : 100)) / (cur === 'CLP' ? 1 : 100) : null
  const missing = 'Falta — pedir al cliente'

  const content = emailParagraph(`Hola, se necesita emitir la siguiente factura${data.sellerName ? ` (negocio de ${data.sellerName})` : ''}:`)
    + emailSummary([
      { label: 'Monto a facturar', value: money(data.amount, cur) },
      { label: 'Cuota', value: data.installments > 1 ? `${data.installment} de ${data.installments}` : 'Única' },
      { label: 'Cotización', value: `N° ${data.quoteNumber}` },
    ])
    + emailHeading('Datos del cliente')
    + emailRows([
      { left: 'Razón social', right: client.legalName || client.company || missing },
      { left: 'RUT', right: client.taxId || missing },
      { left: 'Giro', right: client.activity || missing },
      { left: 'Dirección', right: client.address || missing },
      { left: 'Correo para la factura', right: client.billingEmail || missing },
    ])
    + emailHeading('Detalle')
    + emailRows([
      { left: concept, right: '' },
      ...(net != null ? [
        { left: 'Neto', right: money(net, cur), tone: 'muted' as const },
        { left: data.taxLines.length ? data.taxLines.map(t => `${t.name} ${t.rate} %`).join(' + ') : 'Impuestos', right: money(data.amount - net, cur), tone: 'muted' as const },
      ] : []),
      { left: 'Total', right: money(data.amount, cur), tone: 'strong' as const },
    ])
    + (data.signer ? emailSmall(`Cotización aceptada y firmada por ${data.signer.name} (RUT ${data.signer.rut}).`) : '')
    + emailButton(registerLink, 'Registrar la factura emitida')
    + emailSmall('Al registrarla con su folio queda el documento por cobrar y comienzan los recordatorios de cobranza. Si no tienes acceso al CRM, responde este correo con el folio.')
    + (certificateLink ? emailCallout(emailParagraph(`Comprobante de aceptación del cliente: ${certificateLink}`)) : '')

  const html = emailShell({ subject, brand, content, kicker: 'Solicitud de factura', preheader: `${concept} · ${money(data.amount, cur)}` })
  const text = [
    `Solicitud de factura — ${concept}`,
    `Monto: ${money(data.amount, cur)}${net != null ? ` (neto ${money(net, cur)})` : ''}`,
    `Razón social: ${client.legalName || client.company || missing}`,
    `RUT: ${client.taxId || missing}`,
    `Giro: ${client.activity || missing}`,
    `Dirección: ${client.address || missing}`,
    `Correo para la factura: ${client.billingEmail || missing}`,
    `Registrar la factura emitida: ${registerLink}`,
    ...(certificateLink ? [`Comprobante de aceptación: ${certificateLink}`] : []),
  ].join('\n')
  return { subject, html, text }
}
