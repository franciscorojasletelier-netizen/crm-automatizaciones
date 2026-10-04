// Envía una cotización al cliente por correo: mensaje del ejecutivo, resumen
// y botón al link público para aceptar o rechazar. Sale desde la cuenta
// conectada del ejecutivo (Gmail/Outlook) o, si no tiene, desde el correo
// del sistema con respuestas al ejecutivo. Un borrador pasa a "enviada".
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canEditSection } from '@/lib/roles'
import { canSeeDeal } from '@/lib/visibility'
import { sendAsUser } from '@/lib/email/send-as-user'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { renderQuoteEmail } from '@/lib/quote-email'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let ctx: Awaited<ReturnType<typeof getCurrentProfile>>
  try { ctx = await getCurrentProfile() } catch { return NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { user, role, sectionAccess, organizationId, supabase } = ctx
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
  if (!['super_admin', 'gerente', 'comercial'].includes(role) || !canEditSection(role, sectionAccess, 'leads')) {
    return NextResponse.json({ error: 'Sin permiso para enviar cotizaciones' }, { status: 403 })
  }

  const payload = await request.json().catch(() => ({}))
  const to = String(payload.to ?? '').trim()
  const subject = String(payload.subject ?? '').trim().slice(0, 200)
  const message = String(payload.message ?? '').trim().slice(0, 5_000)
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Correo de destino no válido' }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Falta el asunto' }, { status: 400 })
  if (!message) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })

  // Con el cliente de sesión: la RLS decide si la ve.
  const { data: quote } = await supabase.from('quotes')
    .select('id, deal_id, quote_number, status, items, taxes, tax_rate, currency, valid_until, notes, public_token')
    .eq('id', id).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  if (!(await canSeeDeal(supabase, user.id, role, quote.deal_id))) return NextResponse.json({ error: 'Sin acceso a este deal' }, { status: 403 })
  if (quote.status === 'accepted' || quote.status === 'rejected') {
    return NextResponse.json({ error: 'Esta cotización ya fue respondida por el cliente' }, { status: 409 })
  }
  if (!(quote.items as unknown[] | null)?.length) return NextResponse.json({ error: 'La cotización no tiene ítems' }, { status: 400 })

  // Link público: se genera al enviar (un borrador no tiene).
  let token = quote.public_token as string | null
  if (!token || quote.status === 'draft') {
    token = token ?? crypto.randomUUID()
    const { error: upErr } = await supabase.from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString(), public_token: token }).eq('id', quote.id)
    if (upErr) return NextResponse.json({ error: `No se pudo preparar el link: ${upErr.message}` }, { status: 500 })
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
  const link = `${origin}/cotizacion/${token}`

  const [{ data: account }, { data: org }, { data: me }] = await Promise.all([
    supabase.from('email_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('organizations').select('name, display_name, logo_url, email, phone, address').eq('id', organizationId).maybeSingle(),
    supabase.from('profiles').select('email').eq('id', user.id).maybeSingle(),
  ])
  const orgName = org?.display_name || org?.name || 'Tu proveedor'
  const mail = renderQuoteEmail({
    quote: { ...quote, items: quote.items as never },
    message, link, subject,
    brand: { name: orgName, logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address },
  })

  if (account) {
    const sent = await sendAsUser(supabase, user.id, { to, subject, body: mail.text, html: mail.html })
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status })
    // Queda en el historial de correos del deal.
    const { data: deal } = await supabase.from('deals').select('primary_contact_id').eq('id', quote.deal_id).maybeSingle()
    await sent.svc.from('email_messages').insert({
      organization_id: organizationId, deal_id: quote.deal_id, contact_id: deal?.primary_contact_id ?? null,
      email_account_id: sent.accountId, direction: 'outbound',
      subject, body_text: mail.text, body_html: mail.html,
      from_address: sent.fromAddress, to_addresses: [to],
      provider_message_id: sent.messageId, thread_id: sent.threadId,
      sent_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, via: sent.fromAddress, link })
  }
  if (systemMailConfigured()) {
    const sent = await sendSystemMail({ to, subject, body: mail.text, html: mail.html, fromName: orgName, replyTo: me?.email ?? null })
    if (!sent.ok) return NextResponse.json({ error: `No se pudo enviar: ${sent.error}` }, { status: 502 })
    return NextResponse.json({ ok: true, via: sent.from, link })
  }
  return NextResponse.json({ error: 'No hay correo configurado: conecta tu cuenta en Configuración o pide al administrador activar el correo del sistema.' }, { status: 400 })
}
