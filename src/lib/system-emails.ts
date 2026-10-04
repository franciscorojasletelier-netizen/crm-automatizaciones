// Correos del sistema con la plantilla común: respuesta automática al
// prospecto, aviso de lead nuevo, restablecer contraseña e invitación.
import { emailButton, emailCallout, emailHeading, emailParagraph, emailRows, emailShell, EMAIL_COLORS, EMAIL_FONT, type EmailBrand } from '@/lib/email-layout'
import { escapeHtml } from '@/lib/html'

const greeting = (name?: string | null) => {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Hola ${first}` : 'Hola'
}
const title = (text: string) => `<div style="font:600 20px/1.35 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};margin:0 0 12px;">${escapeHtml(text)}</div>`

/** Al prospecto que llenó el formulario web. */
export function renderLeadAutoReply({ contactName, message, brand }: { contactName?: string | null; message?: string | null; brand: EmailBrand }) {
  const subject = `Recibimos tu mensaje — ${brand.name}`
  const content = title(`${greeting(contactName)}, gracias por escribirnos`)
    + emailParagraph('Recibimos tu mensaje y una persona de nuestro equipo te responderá en menos de 2 horas hábiles.')
    + (message ? emailHeading('Tu mensaje') + emailCallout(emailParagraph(message)) : '')
    + emailParagraph('Si necesitas agregar algo, responde directamente a este correo.')
  return { subject, html: emailShell({ subject, brand, content, preheader: 'Te responderemos en menos de 2 horas hábiles.' }) }
}

/** Aviso interno de un lead nuevo (formulario web o Facebook Ads). */
export function renderNewLeadAlert({ contactName, email, phone, company, source, message, link, brand }: {
  contactName?: string | null; email?: string | null; phone?: string | null; company?: string | null
  source: string; message?: string | null; link: string; brand: EmailBrand
}) {
  const who = contactName || company || 'Sin nombre'
  const subject = `Nuevo lead: ${who} (${source})`
  const content = title('Llegó un lead nuevo')
    + emailRows([
      { left: 'Nombre', right: contactName || '—' },
      { left: 'Empresa', right: company || '—' },
      { left: 'Correo', right: email || '—' },
      { left: 'Teléfono', right: phone || '—' },
      { left: 'Fuente', right: source },
    ])
    + (message ? emailHeading('Mensaje') + emailCallout(emailParagraph(message)) : '')
    + emailButton(link, 'Ver el lead en el CRM')
  return { subject, html: emailShell({ subject, brand, content, kicker: 'Lead nuevo', preheader: `${who} · ${source}` }) }
}

/** Enlace para restablecer la contraseña (generado por un administrador). */
export function renderPasswordReset({ name, link, brand }: { name?: string | null; link: string; brand: EmailBrand }) {
  const subject = `Restablece tu contraseña — ${brand.name}`
  const content = title(greeting(name))
    + emailParagraph(`Un administrador de ${brand.name} generó un enlace para que definas una nueva contraseña de acceso al CRM. El enlace vence en 1 hora.`)
    + emailButton(link, 'Definir nueva contraseña')
    + emailParagraph('Si no lo esperabas, puedes ignorar este correo: tu contraseña actual sigue funcionando.')
  return { subject, html: emailShell({ subject, brand, content, kicker: 'Acceso', preheader: 'Define tu nueva contraseña (vence en 1 hora).' }) }
}

/** Invitación al administrador de una organización nueva. */
export function renderInvitation({ name, orgName, planLabel, link, loginUrl, email, brand }: {
  name: string; orgName: string; planLabel: string; link: string; loginUrl: string; email: string; brand: EmailBrand
}) {
  const subject = `Tu cuenta en el CRM de ${orgName}`
  const content = title(`${greeting(name)}, tu CRM está listo`)
    + emailParagraph(`Creamos la cuenta de ${orgName} (plan ${planLabel}) y eres su administrador.`)
    + emailParagraph('Para entrar, define tu contraseña con este botón. El enlace vence en 1 hora; si expira, usa "¿La olvidaste?" en la pantalla de ingreso.')
    + emailButton(link, 'Definir mi contraseña')
    + emailCallout(emailParagraph(`Después ingresa en ${loginUrl} con ${email}.`))
    + emailParagraph('Si no esperabas este correo, puedes ignorarlo.')
  return { subject, html: emailShell({ subject, brand, content, kicker: 'Bienvenida', preheader: `Define tu contraseña para entrar al CRM de ${orgName}.` }) }
}
