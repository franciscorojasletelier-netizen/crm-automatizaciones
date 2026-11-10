import type { SupabaseClient } from '@supabase/supabase-js'
import { associateEmailToDeal, emailDomain, isFreeEmailDomain } from './associate'

export type InboundEmail = {
  providerMessageId: string
  threadId: string
  fromAddress: string
  to: string[]
  subject: string
  bodyText: string
  bodyHtml: string
  sentAt: string
  /** El proveedor lo marca como enviado por la propia cuenta (etiqueta SENT). */
  sentByAccount?: boolean
  /** Cabeceras de envío masivo/automático (List-Unsubscribe, Auto-Submitted…). */
  automated?: boolean
}

type Account = { id: string; organization_id: string; user_id: string; email_address: string }

const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?|notificaciones|alerts?)([+.\-_]|@)/i

/** Motivo por el que un correo nunca es conversación con un cliente (null = procesarlo). */
function skipReason(account: Account, email: InboundEmail): string | null {
  const from = email.fromAddress
  const own = account.email_address.trim().toLowerCase()
  if (!from) return 'sin_remitente'
  if (from === own || email.sentByAccount) return 'propio'
  if (email.automated || AUTOMATED_SENDER.test(from)) return 'automatico'
  // Colegas de la propia empresa (mismo dominio corporativo que la cuenta).
  const ownDomain = emailDomain(own)
  if (ownDomain && !isFreeEmailDomain(ownDomain) && emailDomain(from) === ownDomain) return 'interno'
  return null
}

// Sin direcciones ni contenido: solo el id del mensaje y la decisión.
function logDecision(email: InboundEmail, decision: string, extra?: string) {
  console.info(`[email-inbound] ${email.providerMessageId} ${decision}${extra ? ` ${extra}` : ''}`)
}

function excerpt(value: string, max = 80) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

// Procesa un correo recibido (Gmail u Outlook):
//  - descarta los propios, automáticos y de colegas;
//  - si coincide con un contacto o con la empresa de un lead, lo guarda
//    en el historial y avisa al responsable del lead;
//  - si no coincide con nada, NO guarda el contenido y deja una alerta
//    al dueño de la cuenta (una por remitente cada 24 h).
export async function handleInboundEmail(svc: SupabaseClient, account: Account, email: InboundEmail) {
  const reason = skipReason(account, email)
  if (reason) { logDecision(email, `descartado:${reason}`); return }

  const { data: exists } = await svc.from('email_messages')
    .select('id').eq('provider_message_id', email.providerMessageId).maybeSingle()
  if (exists) { logDecision(email, 'duplicado'); return }

  const { contactId, dealId, matchedBy } = await associateEmailToDeal(svc, account.organization_id, email.fromAddress)

  if (!contactId && !dealId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await svc.from('notifications')
      .select('id')
      .eq('user_id', account.user_id).eq('type', 'email_unmatched')
      .eq('title', `Correo sin lead: ${email.fromAddress}`)
      .gte('created_at', since)
      .limit(1)
    logDecision(email, 'sin_lead', recent?.length ? 'alerta_ya_enviada' : 'alerta')
    if (!recent?.length) {
      const { error } = await svc.from('notifications').insert({
        user_id: account.user_id, type: 'email_unmatched',
        title: `Correo sin lead: ${email.fromAddress}`,
        body: `"${excerpt(email.subject)}" — no coincide con ningún contacto ni empresa del CRM. Si es un cliente, créale un lead o agrega el correo a un contacto.`,
      })
      if (error) logDecision(email, 'error_alerta', error.message)
    }
    return
  }

  const { error: insertError } = await svc.from('email_messages').insert({
    organization_id: account.organization_id, deal_id: dealId, contact_id: contactId,
    email_account_id: account.id, direction: 'inbound',
    subject: email.subject, body_text: email.bodyText, body_html: email.bodyHtml,
    from_address: email.fromAddress, to_addresses: email.to,
    provider_message_id: email.providerMessageId, thread_id: email.threadId,
    sent_at: email.sentAt,
  })
  logDecision(email, insertError ? 'error_guardar' : `guardado:${matchedBy}`, insertError?.message ?? (dealId ? 'con_lead' : 'sin_lead_abierto'))
  if (insertError) return

  if (dealId) {
    const { data: deal } = await svc.from('deals').select('owner_id').eq('id', dealId).maybeSingle()
    if (deal?.owner_id) {
      await svc.from('notifications').insert({
        user_id: deal.owner_id, type: 'email_message',
        title: matchedBy === 'domain' ? `Nuevo correo de ${email.fromAddress} (misma empresa)` : 'Nuevo correo',
        body: email.subject, entity_type: 'deal', entity_id: dealId,
      })
    }
  }
}
