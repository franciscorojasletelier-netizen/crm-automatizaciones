import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { CODE_TTL_MINUTES, hashCode, maskEmail, newCode } from '@/lib/quote-acceptance'
import { renderAcceptanceCodeEmail } from '@/lib/quote-email'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

// Envía el código de un solo uso para aceptar una cotización. Va al correo
// al que se envió la cotización (o al del contacto del deal); solo si no
// hay ninguno se usa el que escribe el cliente.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  const ip = getClientIp(request)
  const { allowed } = await checkRateLimit(supabase, 'quote_code', ip, { maxHits: 5, windowMinutes: 15 })
  if (!allowed) return NextResponse.json({ error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' }, { status: 429 })
  if (!systemMailConfigured()) return NextResponse.json({ error: 'El envío de códigos no está disponible. Contacta a tu ejecutivo.' }, { status: 503 })

  const { data: quote } = await supabase.from('quotes')
    .select('id, quote_number, status, sent_to_email, organization_id, deal_id').eq('public_token', token).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  if (quote.status !== 'sent') return NextResponse.json({ error: 'Esta cotización ya fue respondida o no está disponible.' }, { status: 409 })

  // Máximo 5 códigos por cotización por hora.
  const { count } = await supabase.from('quote_acceptance_codes').select('id', { count: 'exact', head: true })
    .eq('quote_id', quote.id).gte('created_at', new Date(Date.now() - 3600_000).toISOString())
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Se enviaron demasiados códigos. Prueba en una hora.' }, { status: 429 })

  const { data: deal } = await supabase.from('deals').select('contacts:primary_contact_id(email)').eq('id', quote.deal_id).maybeSingle()
  const known = quote.sent_to_email || (deal?.contacts as unknown as { email: string | null } | null)?.email || null
  const body = await request.json().catch(() => ({}))
  const typed = String(body.email ?? '').trim().toLowerCase()
  const target = known ?? (EMAIL_RE.test(typed) ? typed : null)
  if (!target) return NextResponse.json({ error: 'Ingresa tu correo para recibir el código.', needsEmail: true }, { status: 400 })

  const { data: org } = await supabase.from('organizations').select('name, display_name, logo_url, email, phone, address').eq('id', quote.organization_id).maybeSingle()
  const brand = { name: org?.display_name || org?.name || 'Tu proveedor', logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address }

  const code = newCode()
  const { error: insErr } = await supabase.from('quote_acceptance_codes').insert({
    quote_id: quote.id, email: target, code_hash: hashCode(quote.id, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  })
  if (insErr) return NextResponse.json({ error: 'No se pudo generar el código' }, { status: 500 })

  const mail = renderAcceptanceCodeEmail({ code, quoteNumber: quote.quote_number, minutes: CODE_TTL_MINUTES, brand })
  const sent = await sendSystemMail({ to: target, subject: mail.subject, body: mail.text, html: mail.html, fromName: brand.name, replyTo: org?.email ?? null })
  if (!sent.ok) return NextResponse.json({ error: 'No se pudo enviar el código. Intenta de nuevo.' }, { status: 502 })

  return NextResponse.json({ ok: true, sentTo: maskEmail(target) })
}
