import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentProfile } from '@/lib/supabase/server'
import { getOAuthAppCredentials } from '@/lib/email/oauth'
import { buildGoogleAuthUrl } from '@/lib/email/gmail'
import { buildMicrosoftAuthUrl } from '@/lib/email/outlook'

const PROVIDER_MAP = { google: 'google_workspace', microsoft: 'microsoft_365' } as const

function appUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: slug } = await params
  const provider = PROVIDER_MAP[slug as keyof typeof PROVIDER_MAP]
  if (!provider) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })

  const { organizationId, supabase } = await getCurrentProfile()
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const creds = await getOAuthAppCredentials(supabase, organizationId, provider)
  if (!creds) {
    return NextResponse.json({ error: 'Esta organización todavía no tiene configurada la app OAuth de correo. Pedile al administrador de la plataforma que la agregue.' }, { status: 400 })
  }

  const redirectUri = `${appUrl(request)}/api/email/callback/${slug}`
  const state = crypto.randomBytes(24).toString('base64url')

  const authUrl = provider === 'google_workspace'
    ? buildGoogleAuthUrl(creds.clientId, redirectUri, state)
    : buildMicrosoftAuthUrl(creds.clientId, redirectUri, state)

  const res = NextResponse.redirect(authUrl)
  // Cookie corta y propia de este flujo — el callback la compara contra
  // el `state` que vuelve del proveedor para descartar un callback
  // forjado por un tercero (protección CSRF estándar de OAuth).
  res.cookies.set(`oauth_state_${slug}`, state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
