// Envía un correo desde la cuenta conectada (Gmail/Outlook) del usuario.
// Compartido por /api/email/send y /api/cobranza/enviar.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { sendGmailMessage } from '@/lib/email/gmail'
import { sendOutlookMessage } from '@/lib/email/outlook'

export function emailServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type SendResult =
  | { ok: true; accountId: string; fromAddress: string; messageId: string; threadId: string | null; svc: SupabaseClient }
  | { ok: false; error: string; status: number }

export async function sendAsUser(
  supabase: SupabaseClient,
  userId: string,
  msg: { to: string; subject: string; body: string; threadId?: string; replyToMessageId?: string },
): Promise<SendResult> {
  // Confirma, con el cliente de sesión del propio usuario (pasa por RLS),
  // que la cuenta le pertenece — el service_role de abajo es solo para
  // leer las columnas de token, que `authenticated` no puede ver ni de su
  // propia fila.
  const { data: owned } = await supabase.from('email_accounts')
    .select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle()
  if (!owned) return { ok: false, error: 'No tienes una cuenta de correo conectada. Conéctala en Configuración.', status: 400 }

  const svc = emailServiceClient()
  const { data: account } = await svc.from('email_accounts')
    .select('id, organization_id, user_id, provider, email_address, access_token, refresh_token, token_expires_at')
    .eq('id', owned.id).maybeSingle()
  if (!account) return { ok: false, error: 'Cuenta de correo no encontrada', status: 404 }

  const accessToken = await ensureFreshAccessToken(svc, account as any)
  if (!accessToken) return { ok: false, error: 'No se pudo renovar el acceso a tu correo — reconéctalo desde Configuración', status: 400 }

  const result = account.provider === 'google_workspace'
    ? await sendGmailMessage(accessToken, { to: msg.to, subject: msg.subject, bodyText: msg.body, threadId: msg.threadId, inReplyTo: msg.replyToMessageId })
    : await sendOutlookMessage(accessToken, { to: msg.to, subject: msg.subject, bodyText: msg.body, replyToMessageId: msg.replyToMessageId })
  if (!result.ok) return { ok: false, error: result.error ?? 'Error al enviar', status: 400 }

  return {
    ok: true, svc, accountId: account.id, fromAddress: account.email_address,
    messageId: result.messageId ?? '', threadId: ('threadId' in result ? result.threadId : null) ?? msg.threadId ?? null,
  }
}
