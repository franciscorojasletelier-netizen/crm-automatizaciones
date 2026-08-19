import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { getOAuthAppCredentials } from '@/lib/email/oauth'
import { exchangeGoogleCode, getGoogleUserEmail, watchGmail } from '@/lib/email/gmail'
import { exchangeMicrosoftCode, getMicrosoftUserEmail, subscribeOutlook } from '@/lib/email/outlook'
import crypto from 'crypto'

const PROVIDER_MAP = { google: 'google_workspace', microsoft: 'microsoft_365' } as const

function appUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: slug } = await params
  const provider = PROVIDER_MAP[slug as keyof typeof PROVIDER_MAP]
  const base = appUrl(request)
  const configUrl = (msg: string, ok: boolean) => {
    const url = new URL('/configuracion', base)
    url.searchParams.set(ok ? 'emailConnected' : 'emailError', msg)
    return url
  }

  if (!provider) return NextResponse.redirect(configUrl('Proveedor inválido', false))

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerError = searchParams.get('error')
  const cookieState = request.cookies.get(`oauth_state_${slug}`)?.value

  if (providerError) return NextResponse.redirect(configUrl('Conexión cancelada', false))
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(configUrl('No se pudo validar la solicitud. Probá de nuevo.', false))
  }

  const { user, organizationId, supabase } = await getCurrentProfile()
  if (!organizationId) return NextResponse.redirect(configUrl('Sin organización', false))

  const creds = await getOAuthAppCredentials(supabase, organizationId, provider)
  if (!creds) return NextResponse.redirect(configUrl('La organización no tiene configurada esta integración', false))

  const redirectUri = `${base}/api/email/callback/${slug}`
  const svc = serviceClient()

  if (provider === 'google_workspace') {
    const tokens = await exchangeGoogleCode(creds, code, redirectUri)
    if (!tokens) return NextResponse.redirect(configUrl('No se pudo completar la conexión con Google', false))
    const email = await getGoogleUserEmail(tokens.accessToken)
    if (!email) return NextResponse.redirect(configUrl('No se pudo leer tu dirección de correo', false))

    const { data: account, error } = await svc.from('email_accounts').upsert({
      organization_id: organizationId, user_id: user.id, provider, email_address: email,
      access_token: tokens.accessToken, refresh_token: tokens.refreshToken ?? null,
      token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
      is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id,provider,email_address' }).select('id').single()
    if (error || !account) return NextResponse.redirect(configUrl('No se pudo guardar la conexión', false))

    // El watch inicial se intenta acá pero no bloquea el alta si falla
    // (falta el tema de Pub/Sub, por ejemplo) — el cron de renovación
    // lo reintenta más adelante.
    const { data: integration } = await svc.from('platform_integrations')
      .select('config').eq('provider', 'google_workspace').eq('organization_id', organizationId).maybeSingle()
    const topicName = (integration?.config as any)?.pubsub_topic
    if (topicName) {
      const watch = await watchGmail(tokens.accessToken, topicName)
      if (watch) {
        await svc.from('email_accounts').update({
          sync_cursor: watch.historyId, subscription_expires_at: new Date(Number(watch.expiration)).toISOString(),
        }).eq('id', account.id)
      }
    }

    const res = NextResponse.redirect(configUrl(email, true))
    res.cookies.delete(`oauth_state_${slug}`)
    return res
  }

  // microsoft_365
  const tokens = await exchangeMicrosoftCode(creds, code, redirectUri)
  if (!tokens) return NextResponse.redirect(configUrl('No se pudo completar la conexión con Microsoft', false))
  const email = await getMicrosoftUserEmail(tokens.accessToken)
  if (!email) return NextResponse.redirect(configUrl('No se pudo leer tu dirección de correo', false))

  const { data: account, error } = await svc.from('email_accounts').upsert({
    organization_id: organizationId, user_id: user.id, provider, email_address: email,
    access_token: tokens.accessToken, refresh_token: tokens.refreshToken ?? null,
    token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
    is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,user_id,provider,email_address' }).select('id').single()
  if (error || !account) return NextResponse.redirect(configUrl('No se pudo guardar la conexión', false))

  const clientState = crypto.randomBytes(16).toString('hex')
  const sub = await subscribeOutlook(tokens.accessToken, `${base}/api/webhooks/outlook`, clientState)
  if (sub) {
    await svc.from('email_accounts').update({
      subscription_id: sub.subscriptionId, subscription_expires_at: sub.expirationDateTime,
      sync_cursor: clientState,
    }).eq('id', account.id)
  }

  const res = NextResponse.redirect(configUrl(email, true))
  res.cookies.delete(`oauth_state_${slug}`)
  return res
}
