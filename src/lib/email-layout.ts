// ============================================================
//  Plantilla común de los correos del CRM (cotizaciones, tareas, avisos).
//  Mismo diseño que el estado de cuenta de cobranza: tarjeta blanca con
//  franja de color, logo o nombre de la empresa, contenido y pie con los
//  datos de contacto.
//
//  HTML de correo: tablas y estilos en línea (Gmail y Outlook ignoran
//  <style>). Todo dato variable pasa por escapeHtml antes de llegar acá;
//  `content` ya viene armado con los helpers de abajo.
// ============================================================
import { escapeHtml } from '@/lib/html'

export const EMAIL_COLORS = {
  page: '#f1f5f9', card: '#ffffff', border: '#e2e8f0', soft: '#f8fafc',
  ink: '#0f172a', text: '#334155', muted: '#64748b',
  accent: '#2f55d4', accentSoft: '#eef2ff',
  red: '#b91c1c', redSoft: '#fef2f2', amber: '#b45309', green: '#047857',
}
export const EMAIL_FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
const C = EMAIL_COLORS
const F = EMAIL_FONT

export interface EmailBrand {
  name: string
  logoUrl?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

/** Párrafo de texto (respeta saltos de línea simples). */
export function emailParagraph(text: string) {
  return `<p style="margin:0 0 14px;font:400 15px/1.6 ${F};color:${C.text};">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`
}

/** Botón principal. */
export function emailButton(href: string, label: string, color = C.accent) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr>
    <td style="background:${color};border-radius:8px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr></table>`
}

/** Título de sección dentro del contenido. */
export function emailHeading(text: string, color = C.ink) {
  return `<div style="font:600 15px/1.4 ${F};color:${color};margin:6px 0 8px;">${escapeHtml(text)}</div>`
}

/** Tabla de filas [izquierda, derecha] con separadores (listas de tareas, ítems, totales). */
export function emailRows(rows: { left: string; sub?: string | null; right?: string; tone?: 'normal' | 'danger' | 'strong' }[]) {
  const body = rows.map(r => {
    const color = r.tone === 'danger' ? C.red : C.ink
    const weight = r.tone === 'strong' ? 700 : 600
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.border};" valign="top">
        <div style="font:${weight} 14px/1.4 ${F};color:${color};">${escapeHtml(r.left)}</div>
        ${r.sub ? `<div style="font:400 13px/1.4 ${F};color:${C.muted};">${escapeHtml(r.sub)}</div>` : ''}
      </td>
      <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid ${C.border};white-space:nowrap;font:${weight} 14px/1.4 ${F};color:${r.tone === 'danger' ? C.red : C.text};" valign="top">${escapeHtml(r.right ?? '')}</td>
    </tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;">${body}</table>`
}

/** Recuadro destacado (resumen, aviso). */
export function emailCallout(html: string, tone: 'soft' | 'danger' = 'soft') {
  const bg = tone === 'danger' ? C.redSoft : C.soft
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td style="padding:14px 16px;background:${bg};border:1px solid ${C.border};border-radius:10px;">${html}</td></tr></table>`
}

/**
 * Documento completo. `kicker` va arriba a la derecha (tipo de correo y
 * fecha); `bar` es el color de la franja superior.
 */
export function emailShell({ subject, preheader, brand, kicker, content, footerNote, bar = C.accent }: {
  subject: string
  preheader?: string
  brand: EmailBrand
  kicker?: string
  content: string
  footerNote?: string
  bar?: string
}) {
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" height="36" style="display:block;height:36px;max-width:180px;border:0;">`
    : `<div style="font:700 18px/1.3 ${F};color:${C.ink};">${escapeHtml(brand.name)}</div>`
  const contact = [brand.email, brand.phone, brand.address].filter(Boolean).map(v => escapeHtml(v)).join(' · ')
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr><td style="height:4px;background:${bar};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:22px 24px 18px;border-bottom:1px solid ${C.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle">${logo}</td>
          ${kicker ? `<td align="right" valign="middle" style="font:400 12px/1.4 ${F};color:${C.muted};">${escapeHtml(kicker).replace(/\n/g, '<br>')}</td>` : ''}
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 24px 8px;">${content}</td></tr>
      <tr><td style="padding:16px 24px 22px;border-top:1px solid ${C.border};font:400 12px/1.6 ${F};color:${C.muted};">
        ${escapeHtml(brand.name)}${contact ? `<br>${contact}` : ''}${footerNote ? `<br><span style="color:#94a3b8;">${escapeHtml(footerNote)}</span>` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
