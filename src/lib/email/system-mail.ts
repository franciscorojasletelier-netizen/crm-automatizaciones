// Correo "del sistema" vía Resend: respaldo cuando el usuario no conectó
// su Gmail/Outlook. Sale desde EMAIL_FROM (dominio verificado en Resend)
// con el nombre de la organización, y las respuestas van al ejecutivo.
import { Resend } from 'resend'

/** Dirección de EMAIL_FROM sin nombre: "Cobranza <a@b.cl>" -> "a@b.cl". */
function fromAddress(): string | null {
  const raw = process.env.EMAIL_FROM?.trim()
  if (!raw) return null
  const m = raw.match(/<([^>]+)>/)
  return (m ? m[1] : raw).trim() || null
}

/**
 * Configurado solo con clave y remitente propio: el remitente de prueba
 * de Resend (onboarding@resend.dev) no entrega a terceros.
 */
export function systemMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!fromAddress()
}

export function systemMailAddress(): string | null {
  return systemMailConfigured() ? fromAddress() : null
}

export async function sendSystemMail(msg: { to: string; subject: string; body: string; html?: string; fromName?: string | null; replyTo?: string | null }) {
  const key = process.env.RESEND_API_KEY?.trim()
  const address = fromAddress()
  if (!key || !address) return { ok: false as const, error: 'El correo del sistema no está configurado' }
  // El nombre visible no puede llevar comillas ni <> (rompe la cabecera From).
  const name = (msg.fromName ?? '').replace(/["<>\r\n]/g, '').trim()
  const { data, error } = await new Resend(key).emails.send({
    from: name ? `${name} <${address}>` : address,
    to: [msg.to],
    subject: msg.subject.replace(/[\r\n]+/g, ' '),
    text: msg.body,
    ...(msg.html ? { html: msg.html } : {}),
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, id: data?.id ?? null, from: address }
}
