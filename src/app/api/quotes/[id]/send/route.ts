// Envía una cotización al cliente por correo: mensaje del ejecutivo, resumen
// y botón al link público para aceptar o rechazar. Sale desde la cuenta
// conectada del ejecutivo (Gmail/Outlook) o, si no tiene, desde el correo
// del sistema con respuestas al ejecutivo. Un borrador pasa a "enviada".
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canEditSection } from '@/lib/roles'
import { canSeeDeal } from '@/lib/visibility'
import { sendAsUser, emailServiceClient } from '@/lib/email/send-as-user'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { renderQuoteEmail } from '@/lib/quote-email'
import { getStages, stageByKey } from '@/lib/stages'
import { changeDealStage } from '@/lib/deal-stage-change'

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
    .select('id, deal_id, quote_number, status, items, taxes, tax_rate, currency, valid_until, notes, public_token, payment_terms, payment_conditions')
    .eq('id', id).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  if (!(await canSeeDeal(supabase, user.id, role, quote.deal_id))) return NextResponse.json({ error: 'Sin acceso a este deal' }, { status: 403 })
  if (quote.status === 'accepted' || quote.status === 'rejected') {
    return NextResponse.json({ error: 'Esta cotización ya fue respondida por el cliente' }, { status: 409 })
  }
  if (!(quote.items as unknown[] | null)?.length) return NextResponse.json({ error: 'La cotización no tiene ítems' }, { status: 400 })

  // Link público: se prepara antes del envío, pero la cotización pasa a
  // "enviada" solo cuando el correo salió (si falla, sigue en borrador).
  let token = quote.public_token as string | null
  if (!token) {
    token = crypto.randomUUID()
    const { error: upErr } = await supabase.from('quotes').update({ public_token: token }).eq('id', quote.id)
    if (upErr) return NextResponse.json({ error: `No se pudo preparar el link: ${upErr.message}` }, { status: 500 })
  }
  // También guarda a qué correo se envió: ahí llega el código para aceptar.
  const markSent = async () => {
    await supabase.from('quotes').update(quote.status === 'draft'
      ? { status: 'sent', sent_at: new Date().toISOString(), sent_to_email: to.toLowerCase() }
      : { sent_to_email: to.toLowerCase() }).eq('id', quote.id)
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
  const link = `${origin}/cotizacion/${token}`

  const [{ data: account }, { data: org }, { data: me }] = await Promise.all([
    supabase.from('email_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('organizations').select('name, display_name, logo_url, email, phone, address').eq('id', organizationId).maybeSingle(),
    supabase.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle(),
  ])
  const orgName = org?.display_name || org?.name || 'Tu proveedor'
  const mail = renderQuoteEmail({
    quote: { ...quote, items: quote.items as never },
    message, link, subject,
    brand: { name: orgName, logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address },
  })

  let record: { email_account_id: string | null; from_address: string; provider_message_id: string | null; thread_id: string | null }
  if (account) {
    const sent = await sendAsUser(supabase, user.id, { to, subject, body: mail.text, html: mail.html })
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status })
    record = { email_account_id: sent.accountId, from_address: sent.fromAddress, provider_message_id: sent.messageId, thread_id: sent.threadId }
  } else if (systemMailConfigured()) {
    const sent = await sendSystemMail({ to, subject, body: mail.text, html: mail.html, fromName: me?.full_name ? `${me.full_name} · ${orgName}` : orgName, replyTo: me?.email ?? null })
    if (!sent.ok) return NextResponse.json({ error: `No se pudo enviar: ${sent.error}` }, { status: 502 })
    record = { email_account_id: null, from_address: sent.from, provider_message_id: sent.id, thread_id: null }
  } else {
    return NextResponse.json({ error: 'No hay correo configurado: conecta tu cuenta en Configuración o pide al administrador activar el correo del sistema.' }, { status: 400 })
  }

  await markSent()

  // La cotización enviada ES la propuesta: si el deal está en una etapa
  // anterior a la de propuesta (la que exige adjunto), avanza solo.
  const { data: dealRow } = await supabase.from('deals').select('stage, status, pipeline_id').eq('id', quote.deal_id).maybeSingle()
  if (dealRow?.status === 'open') {
    const stages = await getStages(supabase, organizationId, dealRow.pipeline_id ?? undefined)
    const current = stageByKey(stages, dealRow.stage)
    const proposal = stages.filter(s => s.requiresAttachment && !s.isTerminal).sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (proposal && current && !current.isTerminal && current.sortOrder < proposal.sortOrder) {
      await changeDealStage(supabase, { dealId: quote.deal_id, fromStage: current.key, toStage: proposal.key, stages, currency: ctx.currency })
    }
  }
  // Queda en el historial de correos del deal.
  const { data: deal } = await supabase.from('deals').select('primary_contact_id').eq('id', quote.deal_id).maybeSingle()
  await emailServiceClient().from('email_messages').insert({
    organization_id: organizationId, deal_id: quote.deal_id, contact_id: deal?.primary_contact_id ?? null,
    direction: 'outbound', subject, body_text: mail.text, body_html: mail.html, to_addresses: [to],
    sent_at: new Date().toISOString(), ...record,
  })
  return NextResponse.json({ ok: true, via: record.from_address, link })
}
