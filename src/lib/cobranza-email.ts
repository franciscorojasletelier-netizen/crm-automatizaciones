// ============================================================
//  Correo de cobranza con diseño (HTML) + versión de texto.
//
//  HTML de correo: tablas y estilos en línea (Gmail y Outlook ignoran
//  <style> y la mayoría del CSS moderno). Todo dato variable pasa por
//  escapeHtml. El cuerpo lo escribe el ejecutivo; la línea {detalle} se
//  reemplaza por el resumen y la tabla de documentos.
// ============================================================
import { DATE_ONLY_TZ, CHILE_TZ } from '@/lib/dates'
import { money } from '@/lib/format'
import { escapeHtml } from '@/lib/html'
import { DETAIL_MARKER, detailText, type Statement, type Tone } from '@/lib/cobranza-mensajes'
import { EMAIL_MOBILE_CSS } from '@/lib/email-layout'

export interface EmailOrg {
  name: string
  logoUrl?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  paymentInstructions?: string | null
}

const C = {
  page: '#f1f5f9', card: '#ffffff', border: '#e2e8f0', soft: '#f8fafc',
  ink: '#0f172a', text: '#334155', muted: '#64748b',
  accent: '#2f55d4', accentSoft: '#eef2ff',
  red: '#b91c1c', redSoft: '#fef2f2', amber: '#b45309',
}

const TONE_BAR: Record<Tone, string> = { recordatorio: C.accent, vencido: C.amber, firme: C.red }

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'short', year: 'numeric' })

function summaryCell(label: string, value: string, color = C.ink) {
  return `<td class="em-cell" width="32%" style="padding:12px 12px;background:${C.soft};border:1px solid ${C.border};border-radius:8px;" valign="top">
    <div style="font:500 12px/1.4 ${FONT};color:${C.muted};">${escapeHtml(label)}</div>
    <div style="font:600 17px/1.3 ${FONT};color:${color};margin-top:4px;">${escapeHtml(value)}</div>
  </td>`
}

function detailHtml(st: Statement) {
  const rows = st.lines.map(l => {
    const late = l.daysLate > 0
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${C.border};" valign="top">
        <div style="font:600 14px/1.4 ${FONT};color:${C.ink};">${escapeHtml(l.document)}</div>
        <div style="font:400 13px/1.4 ${FONT};color:${C.muted};">${escapeHtml(l.description)}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${C.border};" valign="top">
        <div style="font:400 13px/1.4 ${FONT};color:${C.text};">${late ? 'Venció' : 'Vence'} el ${escapeHtml(fmtDay(l.dueDate))}</div>
        ${late ? `<div style="font:600 12px/1.4 ${FONT};color:${C.red};">${l.daysLate} ${l.daysLate === 1 ? 'día' : 'días'} de atraso</div>` : ''}
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid ${C.border};white-space:nowrap;font:600 14px/1.4 ${FONT};color:${late ? C.red : C.ink};" valign="top">${escapeHtml(money(l.balance, st.currency))}</td>
    </tr>`
  }).join('')

  const gap = '<td class="em-gap" width="2%" style="font-size:0;line-height:0;">&nbsp;</td>'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:separate;">
    <tr>
      ${summaryCell('Total adeudado', money(st.total, st.currency))}${gap}
      ${summaryCell('Vencido', money(st.overdue, st.currency), st.overdue > 0 ? C.red : C.ink)}${gap}
      ${summaryCell(st.maxDaysLate > 0 ? 'Mayor atraso' : 'Documentos', st.maxDaysLate > 0 ? `${st.maxDaysLate} días` : String(st.lines.length))}
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">
    <tr>
      <td style="padding:0 0 8px;border-bottom:1px solid ${C.border};font:500 12px/1.4 ${FONT};color:${C.muted};">Documento</td>
      <td style="padding:0 12px 8px;border-bottom:1px solid ${C.border};font:500 12px/1.4 ${FONT};color:${C.muted};">Vencimiento</td>
      <td align="right" style="padding:0 0 8px;border-bottom:1px solid ${C.border};font:500 12px/1.4 ${FONT};color:${C.muted};">Saldo</td>
    </tr>
    ${rows}
    <tr>
      <td colspan="2" style="padding:14px 0 0;font:600 14px/1.4 ${FONT};color:${C.ink};">Total adeudado</td>
      <td align="right" style="padding:14px 0 0;font:700 16px/1.4 ${FONT};color:${C.ink};white-space:nowrap;">${escapeHtml(money(st.total, st.currency))}</td>
    </tr>
  </table>`
}

function paymentHtml(text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 8px;border-collapse:separate;">
    <tr><td style="padding:16px 18px;background:${C.accentSoft};border:1px solid #c7d2fe;border-radius:8px;">
      <div style="font:600 14px/1.4 ${FONT};color:${C.ink};margin-bottom:6px;">Cómo pagar</div>
      <div style="font:400 14px/1.6 ${FONT};color:${C.text};">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    </td></tr>
  </table>`
}

function paragraphHtml(p: string) {
  return `<p style="margin:0 0 16px;font:400 15px/1.6 ${FONT};color:${C.text};">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
}

/**
 * Arma el correo: html (con diseño) y text (alternativa). Si el
 * ejecutivo borró la línea {detalle}, el detalle va después del saludo
 * y la introducción.
 */
export function renderCollectionEmail({ body, subject, statement, tone, org }: {
  body: string; subject: string; statement: Statement; tone: Tone; org: EmailOrg
}): { html: string; text: string } {
  const pay = org.paymentInstructions?.trim()
  const paragraphs = body.replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  if (!paragraphs.includes(DETAIL_MARKER)) paragraphs.splice(Math.min(2, paragraphs.length), 0, DETAIL_MARKER)

  const detailBlock = detailHtml(statement) + (pay ? paymentHtml(pay) : '')
  const content = paragraphs.map(p => p === DETAIL_MARKER ? detailBlock : paragraphHtml(p)).join('')

  const today = new Date().toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' })
  const brand = org.logoUrl
    ? `<img src="${escapeHtml(org.logoUrl)}" alt="${escapeHtml(org.name)}" height="36" style="display:block;height:36px;max-width:180px;border:0;">`
    : `<div style="font:700 18px/1.3 ${FONT};color:${C.ink};">${escapeHtml(org.name)}</div>`
  const contact = [org.email, org.phone, org.address].filter(Boolean).map(v => escapeHtml(v)).join(' · ')
  const preheader = `Total adeudado ${money(statement.total, statement.currency)} · ${statement.lines.length} ${statement.lines.length === 1 ? 'documento' : 'documentos'}`

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title>${EMAIL_MOBILE_CSS}</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td class="em-outer" align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr><td style="height:4px;background:${TONE_BAR[tone]};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td class="em-pad" style="padding:22px 24px 18px;border-bottom:1px solid ${C.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle">${brand}</td>
          <td align="right" valign="middle" style="font:400 12px/1.4 ${FONT};color:${C.muted};">Estado de cuenta<br>${escapeHtml(today)}</td>
        </tr></table>
      </td></tr>
      <tr><td class="em-pad" style="padding:24px 24px 8px;">${content}</td></tr>
      <tr><td class="em-pad" style="padding:16px 24px 22px;border-top:1px solid ${C.border};font:400 12px/1.6 ${FONT};color:${C.muted};">
        ${escapeHtml(org.name)}${contact ? `<br>${contact}` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const text = body.includes(DETAIL_MARKER)
    ? body.replace(DETAIL_MARKER, detailText(statement) + (pay ? `\n\nCómo pagar:\n${pay}` : ''))
    : `${body}\n\n${detailText(statement)}${pay ? `\n\nCómo pagar:\n${pay}` : ''}`

  return { html, text }
}
