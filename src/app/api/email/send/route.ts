import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'
import { sendAsUser, emailServiceClient } from '@/lib/email/send-as-user'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { emailParagraph, emailShell } from '@/lib/email-layout'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

// Correo desde la ficha del lead: por la cuenta conectada del ejecutivo
// (Gmail/Outlook, con hilo) o, si no tiene, por el correo del sistema con
// respuestas a su correo. En ambos casos con la plantilla de la empresa.
export async function POST(request: NextRequest) {
  const { user, role, organizationId, supabase, profile } = await getCurrentProfile()
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const { dealId, contactId, to, subject, body, replyToMessageId, threadId } = await request.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject y body son requeridos' }, { status: 400 })
  }
  if (!EMAIL_RE.test(String(to).trim())) return NextResponse.json({ error: 'Correo de destino no válido' }, { status: 400 })

  // El insert del historial va con service_role (salta RLS): sin esto, un
  // dealId/contactId arbitrario del body quedaba enganchado a un deal o
  // contacto de otra organización.
  if (dealId && !(await canSeeDeal(supabase, user.id, role, dealId))) {
    return NextResponse.json({ error: 'Sin acceso a este deal' }, { status: 403 })
  }
  if (contactId) {
    const { data: contact } = await supabase.from('contacts').select('id').eq('id', contactId).maybeSingle()
    if (!contact) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
  }

  const [{ data: org }, { data: account }] = await Promise.all([
    supabase.from('organizations').select('name, display_name, logo_url, email, phone, address').eq('id', organizationId).maybeSingle(),
    supabase.from('email_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
  ])
  const orgName = org?.display_name || org?.name || 'CRM'
  const signature = [profile?.full_name, orgName].filter(Boolean).join('\n')
  const paragraphs = String(body).replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const html = emailShell({
    subject: String(subject), brand: { name: orgName, logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address },
    content: paragraphs.map(emailParagraph).join('') + emailParagraph(signature),
  })
  const text = `${body}\n\n${signature}`

  let record: { email_account_id: string | null; from_address: string; provider_message_id: string | null; thread_id: string | null }
  if (account) {
    const sent = await sendAsUser(supabase, user.id, { to, subject, body: text, html, threadId, replyToMessageId })
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status })
    record = { email_account_id: sent.accountId, from_address: sent.fromAddress, provider_message_id: sent.messageId, thread_id: sent.threadId }
  } else if (systemMailConfigured()) {
    const sent = await sendSystemMail({ to, subject, body: text, html, fromName: profile?.full_name ? `${profile.full_name} · ${orgName}` : orgName, replyTo: profile?.email ?? null })
    if (!sent.ok) return NextResponse.json({ error: `No se pudo enviar: ${sent.error}` }, { status: 502 })
    record = { email_account_id: null, from_address: sent.from, provider_message_id: sent.id, thread_id: null }
  } else {
    return NextResponse.json({ error: 'No hay correo configurado: conecta tu cuenta en Configuración o pide al administrador activar el correo del sistema.' }, { status: 400 })
  }

  const { data: saved, error } = await emailServiceClient().from('email_messages').insert({
    organization_id: organizationId, deal_id: dealId ?? null, contact_id: contactId ?? null,
    direction: 'outbound', subject, body_text: text, body_html: html, to_addresses: [to],
    sent_at: new Date().toISOString(), ...record,
  }).select().single()

  if (error) return NextResponse.json({ error: 'Se envió pero no se pudo guardar en el historial' }, { status: 500 })
  return NextResponse.json({ ok: true, message: saved })
}
