import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { sendGmailMessage } from '@/lib/email/gmail'
import { sendOutlookMessage } from '@/lib/email/outlook'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  const { user, organizationId, supabase } = await getCurrentProfile()
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const { dealId, contactId, to, subject, body, replyToMessageId, threadId } = await request.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject y body son requeridos' }, { status: 400 })
  }

  // Confirma, con el cliente de sesión del propio usuario (pasa por
  // RLS), que la cuenta le pertenece — el service_role de abajo es
  // solo para poder leer las columnas de token, que `authenticated`
  // no puede ver ni de su propia fila.
  const { data: owned } = await supabase.from('email_accounts')
    .select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'No tenés una cuenta de correo conectada' }, { status: 400 })

  const svc = serviceClient()
  const { data: account } = await svc.from('email_accounts')
    .select('id, organization_id, user_id, provider, email_address, access_token, refresh_token, token_expires_at')
    .eq('id', owned.id).maybeSingle()
  if (!account) return NextResponse.json({ error: 'Cuenta de correo no encontrada' }, { status: 404 })

  const accessToken = await ensureFreshAccessToken(svc, account as any)
  if (!accessToken) return NextResponse.json({ error: 'No se pudo renovar el acceso a tu correo — reconectalo desde Configuración' }, { status: 400 })

  const result = account.provider === 'google_workspace'
    ? await sendGmailMessage(accessToken, { to, subject, bodyText: body, threadId, inReplyTo: replyToMessageId })
    : await sendOutlookMessage(accessToken, { to, subject, bodyText: body, replyToMessageId })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data: saved, error } = await svc.from('email_messages').insert({
    organization_id: organizationId, deal_id: dealId ?? null, contact_id: contactId ?? null,
    email_account_id: account.id, direction: 'outbound',
    subject, body_text: body, body_html: null,
    from_address: account.email_address, to_addresses: [to],
    provider_message_id: result.messageId, thread_id: result.threadId ?? threadId ?? null,
    sent_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: 'Se envió pero no se pudo guardar en el historial' }, { status: 500 })
  return NextResponse.json({ ok: true, message: saved })
}
