import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'
import { sendAsUser } from '@/lib/email/send-as-user'

export async function POST(request: NextRequest) {
  const { user, role, organizationId, supabase } = await getCurrentProfile()
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const { dealId, contactId, to, subject, body, replyToMessageId, threadId } = await request.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject y body son requeridos' }, { status: 400 })
  }

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

  const sent = await sendAsUser(supabase, user.id, { to, subject, body, threadId, replyToMessageId })
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status })

  const { data: saved, error } = await sent.svc.from('email_messages').insert({
    organization_id: organizationId, deal_id: dealId ?? null, contact_id: contactId ?? null,
    email_account_id: sent.accountId, direction: 'outbound',
    subject, body_text: body, body_html: null,
    from_address: sent.fromAddress, to_addresses: [to],
    provider_message_id: sent.messageId, thread_id: sent.threadId,
    sent_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: 'Se envió pero no se pudo guardar en el historial' }, { status: 500 })
  return NextResponse.json({ ok: true, message: saved })
}
