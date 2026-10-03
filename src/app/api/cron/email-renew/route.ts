import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureFreshAccessToken } from '@/lib/email/oauth'
import { watchGmail } from '@/lib/email/gmail'
import { renewOutlookSubscription, subscribeOutlook } from '@/lib/email/outlook'
import crypto from 'crypto'
import { isCronAuthorized } from '@/lib/secure-compare'

// El watch de Gmail vence a los 7 días y la suscripción de Outlook a
// los pocos (acá se crean con 4). Se renuevan con margen para no
// arriesgarse a un hueco de sincronización si el cron se atrasa.
const RENEWAL_WINDOW_HOURS = 24

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-automatizaciones.vercel.app'
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = serviceClient()
  const threshold = new Date(Date.now() + RENEWAL_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data: accounts } = await svc.from('email_accounts')
    .select('id, organization_id, provider, access_token, refresh_token, token_expires_at, subscription_id, subscription_expires_at')
    .eq('is_active', true)
    .or(`subscription_expires_at.is.null,subscription_expires_at.lte.${threshold}`)

  let renewed = 0
  const errors: string[] = []

  for (const account of accounts ?? []) {
    try {
      const accessToken = await ensureFreshAccessToken(svc, account)
      if (!accessToken) { errors.push(`${account.id}: sin token válido`); continue }

      if (account.provider === 'google_workspace') {
        const { data: integration } = await svc.from('platform_integrations')
          .select('config').eq('provider', 'google_workspace').eq('organization_id', account.organization_id).maybeSingle()
        const topicName = (integration?.config as { pubsub_topic?: string } | null)?.pubsub_topic
        if (!topicName) { errors.push(`${account.id}: sin pubsub_topic configurado`); continue }

        const watch = await watchGmail(accessToken, topicName)
        if (!watch) { errors.push(`${account.id}: watch() falló`); continue }
        await svc.from('email_accounts').update({
          subscription_expires_at: new Date(Number(watch.expiration)).toISOString(),
        }).eq('id', account.id)
        renewed++
      } else {
        const renewedSub = account.subscription_id
          ? await renewOutlookSubscription(accessToken, account.subscription_id)
          : null

        if (renewedSub) {
          await svc.from('email_accounts').update({
            subscription_expires_at: renewedSub.expirationDateTime,
          }).eq('id', account.id)
        } else {
          // La suscripción ya no existe o venció más allá de la
          // ventana de renovación de Graph — se crea una nueva.
          const clientState = crypto.randomBytes(16).toString('hex')
          const sub = await subscribeOutlook(accessToken, `${appUrl()}/api/webhooks/outlook`, clientState)
          if (!sub) { errors.push(`${account.id}: no se pudo re-suscribir`); continue }
          await svc.from('email_accounts').update({
            subscription_id: sub.subscriptionId, subscription_expires_at: sub.expirationDateTime,
            sync_cursor: clientState,
          }).eq('id', account.id)
        }
        renewed++
      }
    } catch (e) {
      errors.push(`${account.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, renewed, errors: errors.length ? errors : undefined })
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }
