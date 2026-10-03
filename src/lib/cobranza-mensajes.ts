// ============================================================
//  Cobranza — mensajes al cliente (correo y WhatsApp).
//
//  Funciones puras: arman el estado de cuenta y el texto sugerido a
//  partir de los documentos abiertos. El ejecutivo siempre puede editar
//  el texto antes de enviarlo.
// ============================================================
import { DATE_ONLY_TZ } from '@/lib/dates'
import { money } from '@/lib/format'
import { DOCUMENT_TYPE_LABEL, balanceOf, daysOverdue, type Invoice } from '@/lib/cobranza'

export type Tone = 'recordatorio' | 'vencido' | 'firme'

export const TONE_META: Record<Tone, { label: string; hint: string }> = {
  recordatorio: { label: 'Recordatorio', hint: 'Sin mora: aviso cordial del próximo vencimiento' },
  vencido:      { label: 'Aviso de vencimiento', hint: 'Hasta 30 días de mora' },
  firme:        { label: 'Cobro firme', hint: 'Más de 30 días de mora' },
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'short', year: 'numeric' })

export interface StatementLine {
  id: string
  document: string
  description: string
  issueDate: string
  dueDate: string
  amount: number
  paid: number
  balance: number
  daysLate: number
}

export interface Statement {
  /** Moneda de los documentos (la de la organización). */
  currency: string
  lines: StatementLine[]
  total: number
  overdue: number
  maxDaysLate: number
}

export function documentLabel(inv: Pick<Invoice, 'document_type' | 'document_folio' | 'invoice_number'>) {
  return inv.document_folio
    ? `${DOCUMENT_TYPE_LABEL[inv.document_type]} N° ${inv.document_folio}`
    : `${DOCUMENT_TYPE_LABEL[inv.document_type]} (ref. COB-${String(inv.invoice_number).padStart(4, '0')})`
}

/** Estado de cuenta: documentos con saldo, del más antiguo al más nuevo. */
export function buildStatement(invoices: Invoice[], today: string): Statement {
  const lines = invoices
    .filter(inv => inv.status !== 'anulada' && balanceOf(inv) > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(inv => ({
      id: inv.id,
      document: documentLabel(inv),
      description: inv.description,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      amount: Number(inv.amount),
      paid: Number(inv.paid_amount),
      balance: balanceOf(inv),
      daysLate: daysOverdue(inv, today),
    }))
  const cents = (n: number) => Math.round(n * 100) / 100
  return {
    currency: invoices.find(i => i.currency)?.currency ?? 'CLP',
    lines,
    total: cents(lines.reduce((s, l) => s + l.balance, 0)),
    overdue: cents(lines.filter(l => l.daysLate > 0).reduce((s, l) => s + l.balance, 0)),
    maxDaysLate: lines.reduce((m, l) => Math.max(m, l.daysLate), 0),
  }
}

export function suggestedTone(st: Statement): Tone {
  if (st.maxDaysLate > 30) return 'firme'
  if (st.maxDaysLate > 0) return 'vencido'
  return 'recordatorio'
}

function lineText(l: StatementLine, currency: string) {
  const when = l.daysLate > 0
    ? `venció el ${fmtDay(l.dueDate)} (${l.daysLate} ${l.daysLate === 1 ? 'día' : 'días'} de atraso)`
    : `vence el ${fmtDay(l.dueDate)}`
  return `• ${l.document} — ${l.description}: saldo ${money(l.balance, currency)}, ${when}`
}

interface MessageInput {
  statement: Statement
  tone: Tone
  companyName: string
  contactName?: string | null
  senderName?: string | null
  orgName?: string | null
}

const greeting = (name?: string | null) => {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Hola ${first}` : 'Hola'
}

/**
 * Línea del cuerpo del correo que se reemplaza por el detalle de los
 * documentos: tabla en la versión con diseño, lista en la de texto.
 */
export const DETAIL_MARKER = '{detalle}'

/** Detalle en texto plano (versión sin diseño y WhatsApp largo). */
export function detailText(statement: Statement) {
  return [
    ...statement.lines.map(l => lineText(l, statement.currency)),
    '',
    `Total adeudado: ${money(statement.total, statement.currency)}${statement.overdue > 0 && statement.overdue !== statement.total ? ` (vencido: ${money(statement.overdue, statement.currency)})` : ''}`,
  ].join('\n')
}

/** Correo: asunto + cuerpo editable (el detalle va en DETAIL_MARKER). */
export function emailMessage({ statement, tone, companyName, contactName, senderName, orgName }: MessageInput) {
  const n = statement.lines.length
  const docs = n === 1 ? 'el siguiente documento' : `los siguientes ${n} documentos`
  const from = orgName ? ` de ${orgName}` : ''
  const lateCount = statement.lines.filter(l => l.daysLate > 0).length

  const subject = {
    recordatorio: `Recordatorio de pago · ${companyName}`,
    vencido: `Documentos vencidos · ${companyName}`,
    firme: `Aviso de deuda vencida · ${companyName}`,
  }[tone]

  const intro = {
    recordatorio: `Te escribimos${from} para recordarte ${docs}, pendiente${n === 1 ? '' : 's'} de pago:`,
    vencido: `Te escribimos${from} porque registramos ${docs} con saldo pendiente:`,
    firme: `Te escribimos${from} por la deuda pendiente de ${docs}. ${lateCount === n
      ? (n === 1 ? 'Está vencido' : 'Todos están vencidos')
      : `${lateCount === 1 ? 'Uno de ellos está vencido' : `${lateCount} de ellos están vencidos`}`}, con un atraso de hasta ${statement.maxDaysLate} días:`,
  }[tone]

  const close = {
    recordatorio: 'Si ya realizaste el pago, por favor ignora este mensaje o envíanos el comprobante para registrarlo.',
    vencido: 'Te agradeceríamos regularizar el pago a la brevedad o indicarnos una fecha estimada. Si ya pagaste, envíanos el comprobante y lo registramos de inmediato.',
    firme: 'Necesitamos regularizar esta situación. Te pedimos realizar el pago o contactarnos dentro de los próximos 5 días hábiles para acordar una fecha. Si ya pagaste, envíanos el comprobante.',
  }[tone]

  const body = [
    `${greeting(contactName)}:`,
    '',
    intro,
    '',
    DETAIL_MARKER,
    '',
    close,
    '',
    'Saludos,',
    [senderName, orgName].filter(Boolean).join('\n'),
  ].join('\n').trim()

  return { subject, body }
}

/** WhatsApp: mismo contenido, más corto y directo. */
export function whatsappMessage({ statement, tone, contactName, senderName, orgName }: MessageInput) {
  const n = statement.lines.length
  const head = {
    recordatorio: `te recuerdo que tienes ${n === 1 ? 'un documento' : `${n} documentos`} por pagar`,
    vencido: `te escribo por ${n === 1 ? 'un documento vencido' : `${n} documentos con saldo pendiente`}`,
    firme: `te escribo por una deuda vencida de hasta ${statement.maxDaysLate} días que necesitamos regularizar`,
  }[tone]
  const close = {
    recordatorio: '¿Me confirmas la fecha de pago? Si ya pagaste, envíame el comprobante.',
    vencido: '¿Me indicas cuándo podrías pagar? Si ya pagaste, envíame el comprobante y lo registro.',
    firme: 'Necesito que me confirmes hoy una fecha de pago. Si ya pagaste, envíame el comprobante.',
  }[tone]
  const who = senderName ? `, soy ${senderName.split(/\s+/)[0]}${orgName ? ` de ${orgName}` : ''}` : orgName ? `, te escribimos de ${orgName}` : ''
  return [
    `${greeting(contactName)}${who}: ${head}.`,
    '',
    ...statement.lines.map(l => `• ${l.document}: ${money(l.balance, statement.currency)}${l.daysLate > 0 ? ` (vencido hace ${l.daysLate} d)` : ` (vence ${fmtDay(l.dueDate)})`}`),
    '',
    `Total: ${money(statement.total, statement.currency)}`,
    '',
    close,
  ].join('\n')
}

/**
 * Teléfono a formato wa.me (solo dígitos, con código de país).
 * Asume Chile (+56) cuando el número viene sin código.
 */
export function waPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 9 && d.startsWith('9')) d = '56' + d       // móvil chileno: 9XXXXXXXX
  else if (d.length === 8) d = '569' + d                       // móvil antiguo sin el 9
  else if (d.length === 9 && /^[2-8]/.test(d)) d = '56' + d    // fijo con código de área
  return d.length >= 10 && d.length <= 15 ? d : null
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
