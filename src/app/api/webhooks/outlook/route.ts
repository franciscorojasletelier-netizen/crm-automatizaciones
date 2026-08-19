import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { getOutlookMessage } from '@/lib/email/outlook'
import { associateEmailToDeal } from '@/lib/email/associate'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  // Handshake de validación: Graph llama con esto al crear/renovar la
  // suscripción y espera el token de vuelta tal cual, en texto plano.
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  const body = await request.json().catch(() => null)
  const items: any[] = body?.value ?? []
  if (items.length === 0) return NextResponse.json({ ok: true })

  const svc = serviceClient()

  for (const item of items) {
    const account = await resolveAccount(svc, item.subscriptionId, item.clientState)
    if (!account) continue

    const messageId = item.resourceData?.id
    if (!messageId) continue

    const accessToken = await ensureFreshAccessToken(svc, account as any)
    if (!accessToken) continue

    const msg = await getOutlookMessage(accessToken, messageId)
    if (!msg) continue

    const { data: exists } = await svc.from('email_messages')
      .select('id').eq('provider_message_id', msg.id).maybeSingle()
    if (exists) continue

    const fromAddress = msg.from.trim().toLowerCase()
    const { contactId, dealId } = await associateEmailToDeal(svc, account.organization_id, fromAddress)

    await svc.from('email_messages').insert({
      organization_id: account.organization_id, deal_id: dealId, contact_id: contactId,
      email_account_id: account.id, direction: 'inbound',
      subject: msg.subject, body_text: msg.bodyText, body_html: msg.bodyHtml,
      from_address: fromAddress, to_addresses: msg.to,
      provider_message_id: msg.id, thread_id: msg.conversationId,
      sent_at: msg.receivedDateTime,
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

  return NextResponse.json({ ok: true })
}

async function resolveAccount(svc: ReturnType<typeof serviceClient>, subscriptionId: string, clientState: string) {
  if (!subscriptionId || !clientState) return null
  const { data } = await svc.from('email_accounts')
    .select('id, organization_id, user_id, provider, email_address, access_token, refresh_token, token_expires_at, sync_cursor')
    .eq('provider', 'microsoft_365').eq('subscription_id', subscriptionId).eq('is_active', true)
    .maybeSingle()
  // sync_cursor guarda el clientState acordado al crear la suscripción
  // — si no coincide, la notificación no viene de donde dice venir.
  if (!data || data.sync_cursor !== clientState) return null
  return data
}
