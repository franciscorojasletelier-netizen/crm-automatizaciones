import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { listNewMessageIds, getGmailMessage } from '@/lib/email/gmail'
import { safeEqual } from '@/lib/secure-compare'
import { handleInboundEmail } from '@/lib/email/inbound'

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
  if (!safeEqual(token, process.env.GMAIL_WEBHOOK_TOKEN)) {
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

  const accessToken = await ensureFreshAccessToken(svc, account)
  if (!accessToken) return NextResponse.json({ ok: true })

  const startHistoryId = account.sync_cursor ?? payload.historyId
  if (!startHistoryId) return NextResponse.json({ ok: true })

  const { ids, newHistoryId } = await listNewMessageIds(accessToken, startHistoryId)

  for (const messageId of ids) {
    const msg = await getGmailMessage(accessToken, messageId)
    if (!msg) continue
    await handleInboundEmail(svc, account, {
      providerMessageId: msg.id, threadId: msg.threadId,
      fromAddress: extractAddress(msg.from), to: msg.to,
      subject: msg.subject, bodyText: msg.bodyText, bodyHtml: msg.bodyHtml,
      sentAt: new Date(Number(msg.internalDate)).toISOString(),
      sentByAccount: msg.labelIds.includes('SENT'), automated: msg.automated,
    })
  }

  if (newHistoryId) {
    await svc.from('email_accounts').update({ sync_cursor: newHistoryId }).eq('id', account.id)
  }

  return NextResponse.json({ ok: true })
}
