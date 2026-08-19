// Microsoft Graph — OAuth, suscripción a cambios (webhook nativo, sin
// infraestructura extra a diferencia de Gmail/Pub/Sub) y envío.

const GRAPH_SCOPES = ['offline_access', 'Mail.Read', 'Mail.Send', 'User.Read'].join(' ')
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export function buildMicrosoftAuthUrl(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    response_mode: 'query', scope: GRAPH_SCOPES, state,
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

export async function exchangeMicrosoftCode(
  creds: { clientId: string; clientSecret: string }, code: string, redirectUri: string
) {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId, client_secret: creds.clientSecret,
      code, redirect_uri: redirectUri, grant_type: 'authorization_code',
      scope: GRAPH_SCOPES,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresInSeconds: (data.expires_in as number) ?? 3600,
  }
}

export async function getMicrosoftUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return null
  const data = await res.json()
  return data.mail ?? data.userPrincipalName ?? null
}

// Vence a los 7 días máximo (10.080 min) para el recurso de mensajes —
// un cron la renueva antes. clientState se valida en el webhook para
// confirmar que la notificación viene de esta suscripción y no de un
// tercero que adivinó la URL.
export async function subscribeOutlook(accessToken: string, notificationUrl: string, clientState: string) {
  const expirationDateTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
  const res = await fetch(`${GRAPH_BASE}/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changeType: 'created', notificationUrl, resource: 'me/mailFolders/Inbox/messages',
      expirationDateTime, clientState,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { subscriptionId: data.id as string, expirationDateTime: data.expirationDateTime as string }
}

export async function renewOutlookSubscription(accessToken: string, subscriptionId: string) {
  const expirationDateTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
  const res = await fetch(`${GRAPH_BASE}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expirationDateTime }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { expirationDateTime: data.expirationDateTime as string }
}

export interface OutlookMessage {
  id: string
  conversationId: string
  subject: string
  from: string
  to: string[]
  bodyText: string
  bodyHtml: string
  receivedDateTime: string
}

export async function getOutlookMessage(accessToken: string, messageId: string): Promise<OutlookMessage | null> {
  const res = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}?$select=id,conversationId,subject,from,toRecipients,body,receivedDateTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const isHtml = data.body?.contentType === 'html'
  return {
    id: data.id, conversationId: data.conversationId,
    subject: data.subject ?? '(sin asunto)',
    from: data.from?.emailAddress?.address ?? '',
    to: (data.toRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean),
    bodyText: isHtml ? '' : (data.body?.content ?? ''),
    bodyHtml: isHtml ? (data.body?.content ?? '') : '',
    receivedDateTime: data.receivedDateTime,
  }
}

export async function sendOutlookMessage(
  accessToken: string,
  { to, subject, bodyText, replyToMessageId }: { to: string; subject: string; bodyText: string; replyToMessageId?: string }
) {
  // Responder DENTRO del hilo (createReply) cuando hay mensaje de
  // origen — mantiene el thread_id/conversationId sin reimplementar
  // encabezados MIME a mano, a diferencia de Gmail.
  if (replyToMessageId) {
    const draftRes = await fetch(`${GRAPH_BASE}/me/messages/${replyToMessageId}/createReply`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!draftRes.ok) return { ok: false as const, error: 'No se pudo crear la respuesta' }
    const draft = await draftRes.json()
    const updateRes = await fetch(`${GRAPH_BASE}/me/messages/${draft.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { contentType: 'text', content: bodyText } }),
    })
    if (!updateRes.ok) return { ok: false as const, error: 'No se pudo redactar la respuesta' }
    const sendRes = await fetch(`${GRAPH_BASE}/me/messages/${draft.id}/send`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!sendRes.ok) return { ok: false as const, error: 'No se pudo enviar' }
    return { ok: true as const, messageId: draft.id as string, threadId: draft.conversationId as string }
  }

  const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject, body: { contentType: 'text', content: bodyText },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) return { ok: false as const, error: 'No se pudo enviar' }
  // sendMail no devuelve el mensaje creado — Graph no expone su id acá.
  return { ok: true as const, messageId: null, threadId: null }
}
