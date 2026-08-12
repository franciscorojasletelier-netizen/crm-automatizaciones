import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerAuthClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS_PER_EMAIL = 8
const MAX_ATTEMPTS_PER_IP = 20

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
  }

  const ip = getClientIp(request)
  const normalizedEmail = String(email).trim().toLowerCase()
  const admin = serviceClient()
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const [{ count: emailAttempts }, { count: ipAttempts }] = await Promise.all([
    admin.from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalizedEmail).eq('success', false).gte('created_at', since),
    admin.from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip).eq('success', false).gte('created_at', since),
  ])

  if ((emailAttempts ?? 0) >= MAX_ATTEMPTS_PER_EMAIL || (ipAttempts ?? 0) >= MAX_ATTEMPTS_PER_IP) {
    return NextResponse.json(
      { error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(WINDOW_MINUTES * 60) } }
    )
  }

  const supabase = await createServerAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

  await admin.from('login_attempts').insert({ email: normalizedEmail, ip, success: !error })

  if (error) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
