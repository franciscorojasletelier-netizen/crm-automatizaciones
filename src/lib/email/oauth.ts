import type { SupabaseClient } from '@supabase/supabase-js'

export type EmailProvider = 'google_workspace' | 'microsoft_365'

// Mismo patrón de src/lib/whatsapp.ts: credenciales por organización en
// platform_integrations, con fallback a env vars globales — útil antes
// de que un cliente registre su propia app OAuth, y como salida futura
// si algún día se paga la verificación CASA de una app compartida.
// external_id = client_id, access_token = client_secret (mismo par de
// columnas genéricas que ya usan meta_leads/whatsapp/webhook_form).
export async function getOAuthAppCredentials(
  supabase: SupabaseClient, organizationId: string, provider: EmailProvider
): Promise<{ clientId: string; clientSecret: string } | null> {
  const { data } = await supabase
    .from('platform_integrations')
    .select('external_id, access_token')
    .eq('provider', provider).eq('organization_id', organizationId).eq('is_active', true)
    .maybeSingle()

  const envPrefix = provider === 'google_workspace' ? 'GOOGLE' : 'MICROSOFT'
  const clientId = data?.external_id || process.env[`${envPrefix}_OAUTH_CLIENT_ID`]
  const clientSecret = data?.access_token || process.env[`${envPrefix}_OAUTH_CLIENT_SECRET`]

  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export interface EmailAccountRow {
  id: string
  organization_id: string
  user_id: string
  provider: EmailProvider
  email_address: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}

// Margen de seguridad: refrescar 5 minutos antes de que expire de
// verdad, para no arriesgarse a que el token muera a mitad de una
// llamada a la API del proveedor.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

// Requiere un cliente service_role: access_token/refresh_token son
// columnas que `authenticated` no puede ni leer (ver migración 034).
export async function ensureFreshAccessToken(
  supabase: SupabaseClient, account: EmailAccountRow
): Promise<string | null> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0
  if (account.access_token && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return account.access_token
  }
  if (!account.refresh_token) return null

  const creds = await getOAuthAppCredentials(supabase, account.organization_id, account.provider)
  if (!creds) return null

  const refreshed = account.provider === 'google_workspace'
    ? await refreshGoogleToken(creds, account.refresh_token)
    : await refreshMicrosoftToken(creds, account.refresh_token)

  if (!refreshed) return null

  await supabase.from('email_accounts').update({
    access_token: refreshed.accessToken,
    token_expires_at: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
    // Google no siempre reemite un refresh_token nuevo — solo se pisa
    // si vino uno; Microsoft sí rota el suyo en cada refresh.
    ...(refreshed.refreshToken ? { refresh_token: refreshed.refreshToken } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', account.id)

  return refreshed.accessToken
}

interface RefreshResult { accessToken: string; expiresInSeconds: number; refreshToken?: string }

async function refreshGoogleToken(
  creds: { clientId: string; clientSecret: string }, refreshToken: string
): Promise<RefreshResult | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId, client_secret: creds.clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? 3600 }
}

async function refreshMicrosoftToken(
  creds: { clientId: string; clientSecret: string }, refreshToken: string
): Promise<RefreshResult | null> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId, client_secret: creds.clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
      scope: 'offline_access Mail.Read Mail.Send',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    accessToken: data.access_token, expiresInSeconds: data.expires_in ?? 3600,
    refreshToken: data.refresh_token,
  }
}
