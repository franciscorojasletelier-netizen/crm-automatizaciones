import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { getOutlookMessage } from '@/lib/email/outlook'
import { handleInboundEmail } from '@/lib/email/inbound'

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
  // Notificaciones de Microsoft Graph (solo lo que se lee).
  const items: { subscriptionId: string; clientState?: string; resourceData?: { id?: string } }[] = body?.value ?? []
  if (items.length === 0) return NextResponse.json({ ok: true })

  const svc = serviceClient()

  for (const item of items) {
    const account = await resolveAccount(svc, item.subscriptionId, item.clientState)
    if (!account) continue

    const messageId = item.resourceData?.id
    if (!messageId) continue

    const accessToken = await ensureFreshAccessToken(svc, account)
    if (!accessToken) continue

    const msg = await getOutlookMessage(accessToken, messageId)
    if (!msg) continue

    await handleInboundEmail(svc, account, {
      providerMessageId: msg.id, threadId: msg.conversationId,
      fromAddress: msg.from.trim().toLowerCase(), to: msg.to,
      subject: msg.subject, bodyText: msg.bodyText, bodyHtml: msg.bodyHtml,
      sentAt: msg.receivedDateTime,
    })
  }

  return NextResponse.json({ ok: true })
}

async function resolveAccount(svc: ReturnType<typeof serviceClient>, subscriptionId: string, clientState: string | undefined) {
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
