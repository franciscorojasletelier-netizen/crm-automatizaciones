// Gmail API — OAuth, sincronización incremental por historyId (push vía
// Pub/Sub, no polling) y envío. Requiere que la organización tenga, en
// platform_integrations (provider='google_workspace'): external_id
// (client_id), access_token (client_secret) y config.pubsub_topic
// ("projects/{proyecto}/topics/{tema}" del Google Cloud del cliente).

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: GMAIL_SCOPES, access_type: 'offline', prompt: 'consent', state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGoogleCode(
  creds: { clientId: string; clientSecret: string }, code: string, redirectUri: string
) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId, client_secret: creds.clientSecret,
      code, redirect_uri: redirectUri, grant_type: 'authorization_code',
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

export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.email ?? null
}

// Se re-arma cada pocas horas vía cron — el watch de Gmail vence a los
// 7 días. topicName tiene que existir en el Google Cloud del cliente,
// con el service account gmail-api-push@system.gserviceaccount.com
// como Publisher (paso de configuración manual, no automatizable).
export async function watchGmail(accessToken: string, topicName: string) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicName, labelIds: ['INBOX'] }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { historyId: data.historyId as string, expiration: data.expiration as string }
}

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  to: string[]
  bodyText: string
  bodyHtml: string
  internalDate: string
}

// El push de Pub/Sub solo trae el historyId nuevo — hay que resolverlo
// contra el último cursor guardado para saber qué mensajes son nuevos.
export async function listNewMessageIds(accessToken: string, startHistoryId: string): Promise<{ ids: string[]; newHistoryId: string | null }> {
  const ids = new Set<string>()
  let pageToken: string | undefined
  let newHistoryId: string | null = null

  do {
    const params = new URLSearchParams({ startHistoryId, historyTypes: 'messageAdded' })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // historyId vencido (mailbox reindexada) — hay que resincronizar
    // desde cero, el llamador decide qué hacer con la lista vacía.
    if (res.status === 404) return { ids: [], newHistoryId: null }
    if (!res.ok) break

    const data = await res.json()
    for (const h of data.history ?? []) {
      for (const m of h.messagesAdded ?? []) ids.add(m.message.id)
    }
    if (data.historyId) newHistoryId = data.historyId
    pageToken = data.nextPageToken
  } while (pageToken)

  return { ids: Array.from(ids), newHistoryId }
}

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBody(payload: any): { text: string; html: string } {
  let text = ''; let html = ''
  function walk(part: any) {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data) text += decodeBase64Url(part.body.data)
    if (part.mimeType === 'text/html' && part.body?.data) html += decodeBase64Url(part.body.data)
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return { text, html }
}

export async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  const headers: Record<string, string> = {}
  for (const h of data.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value
  const { text, html } = extractBody(data.payload)

  return {
    id: data.id, threadId: data.threadId,
    subject: headers.subject ?? '(sin asunto)',
    from: headers.from ?? '',
    to: (headers.to ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
    bodyText: text, bodyHtml: html,
    internalDate: data.internalDate,
  }
}

export async function sendGmailMessage(
  accessToken: string,
  { to, subject, bodyText, threadId, inReplyTo }: { to: string; subject: string; bodyText: string; threadId?: string; inReplyTo?: string }
) {
  const headers = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"']
  if (inReplyTo) { headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`) }
  const raw = Buffer.from(`${headers.join('\r\n')}\r\n\r\n${bodyText}`)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  })
  if (!res.ok) return { ok: false as const, error: (await res.json().catch(() => ({})))?.error?.message ?? 'Error al enviar' }
  const data = await res.json()
  return { ok: true as const, messageId: data.id as string, threadId: data.threadId as string }
}
