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

/** Correos que nunca son conversación con un cliente. */
function shouldSkip(account: Account, email: InboundEmail): boolean {
  const from = email.fromAddress
  const own = account.email_address.trim().toLowerCase()
  if (!from || from === own || email.sentByAccount || email.automated) return true
  if (AUTOMATED_SENDER.test(from)) return true
  // Colegas de la propia empresa (mismo dominio corporativo que la cuenta).
  const ownDomain = emailDomain(own)
  if (ownDomain && !isFreeEmailDomain(ownDomain) && emailDomain(from) === ownDomain) return true
  return false
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
  if (shouldSkip(account, email)) return

  const { data: exists } = await svc.from('email_messages')
    .select('id').eq('provider_message_id', email.providerMessageId).maybeSingle()
  if (exists) return

  const { contactId, dealId, matchedBy } = await associateEmailToDeal(svc, account.organization_id, email.fromAddress)

  if (!contactId && !dealId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await svc.from('notifications')
      .select('id')
      .eq('user_id', account.user_id).eq('type', 'email_unmatched')
      .eq('title', `Correo sin lead: ${email.fromAddress}`)
      .gte('created_at', since)
      .limit(1)
    if (!recent?.length) {
      await svc.from('notifications').insert({
        user_id: account.user_id, type: 'email_unmatched',
        title: `Correo sin lead: ${email.fromAddress}`,
        body: `"${excerpt(email.subject)}" — no coincide con ningún contacto ni empresa del CRM. Si es un cliente, créale un lead o agrega el correo a un contacto.`,
      })
    }
    return
  }

  await svc.from('email_messages').insert({
    organization_id: account.organization_id, deal_id: dealId, contact_id: contactId,
    email_account_id: account.id, direction: 'inbound',
    subject: email.subject, body_text: email.bodyText, body_html: email.bodyHtml,
    from_address: email.fromAddress, to_addresses: email.to,
    provider_message_id: email.providerMessageId, thread_id: email.threadId,
    sent_at: email.sentAt,
  })

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
