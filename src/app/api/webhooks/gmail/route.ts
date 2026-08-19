import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { listNewMessageIds, getGmailMessage } from '@/lib/email/gmail'
import { associateEmailToDeal } from '@/lib/email/associate'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function extractAddress(header: string): string {
  const match = header.match(/<([^>]+)>/)
  return (match ? match[1] : header).trim().toLowerCase()
}

export async function POST(request: NextRequest) {
  // Protección liviana: la URL de suscripción de Pub/Sub incluye un
  // token compartido — no es verificación OIDC completa de Google,
  // pero descarta cualquier llamada que no conozca este endpoint
  // específico (mismo nivel de rigor que CRON_SECRET en /api/cron/*).
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.GMAIL_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const dataB64 = body?.message?.data
  if (!dataB64) return NextResponse.json({ ok: true }) // ack, nada que procesar

  let payload: { emailAddress?: string; historyId?: string }
  try {
    payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf-8'))
  } catch {
    return NextResponse.json({ ok: true })
  }
  if (!payload.emailAddress) return NextResponse.json({ ok: true })

  const svc = serviceClient()
  const { data: account } = await svc.from('email_accounts')
    .select('id, organization_id, user_id, provider, email_address, access_token, refresh_token, token_expires_at, sync_cursor')
    .eq('provider', 'google_workspace').eq('email_address', payload.emailAddress).eq('is_active', true)
    .maybeSingle()

  if (!account) return NextResponse.json({ ok: true })

  const accessToken = await ensureFreshAccessToken(svc, account as any)
  if (!accessToken) return NextResponse.json({ ok: true })

  const startHistoryId = account.sync_cursor ?? payload.historyId
  if (!startHistoryId) return NextResponse.json({ ok: true })

  const { ids, newHistoryId } = await listNewMessageIds(accessToken, startHistoryId)

  for (const messageId of ids) {
    const msg = await getGmailMessage(accessToken, messageId)
    if (!msg) continue

    const { data: exists } = await svc.from('email_messages')
      .select('id').eq('provider_message_id', msg.id).maybeSingle()
    if (exists) continue

    const fromAddress = extractAddress(msg.from)
    const { contactId, dealId } = await associateEmailToDeal(svc, account.organization_id, fromAddress)

    await svc.from('email_messages').insert({
      organization_id: account.organization_id, deal_id: dealId, contact_id: contactId,
      email_account_id: account.id, direction: 'inbound',
      subject: msg.subject, body_text: msg.bodyText, body_html: msg.bodyHtml,
      from_address: fromAddress, to_addresses: msg.to,
      provider_message_id: msg.id, thread_id: msg.threadId,
      sent_at: new Date(Number(msg.internalDate)).toISOString(),
    })

    if (dealId) {
      const { data: deal } = await svc.from('deals').select('owner_id').eq('id', dealId).maybeSingle()
      if (deal?.owner_id) {
        await svc.from('notifications').insert({
          user_id: deal.owner_id, type: 'email_message', title: 'Nuevo correo',
          body: msg.subject, entity_type: 'deal', entity_id: dealId,
        })
      }
    }
  }

  if (newHistoryId) {
    await svc.from('email_accounts').update({ sync_cursor: newHistoryId }).eq('id', account.id)
  }

  return NextResponse.json({ ok: true })
}
