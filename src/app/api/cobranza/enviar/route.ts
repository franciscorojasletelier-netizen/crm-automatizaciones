// Envío de cobro al cliente: estado de cuenta por correo (desde la cuenta
// conectada del ejecutivo) o registro de un WhatsApp abierto con wa.me.
// En ambos casos deja una gestión en cada documento abierto del cliente.
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canEditSection } from '@/lib/roles'
import { getDisabledModules } from '@/lib/modules'
import { sendAsUser } from '@/lib/email/send-as-user'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { chileDateString } from '@/lib/dates'
import { clp } from '@/lib/format'
import { INVOICE_SELECT, type Invoice } from '@/lib/cobranza'
import { buildStatement } from '@/lib/cobranza-mensajes'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof getCurrentProfile>>
  try { ctx = await getCurrentProfile() } catch { return NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { user, role, sectionAccess, organizationId, supabase } = ctx
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const disabled = await getDisabledModules(supabase, organizationId)
  if (!canEditSection(role, sectionAccess, 'cobranza', disabled)) {
    return NextResponse.json({ error: 'Sin permiso para gestionar cobranza' }, { status: 403 })
  }

  const payload = await request.json().catch(() => ({}))
  const { companyId, channel } = payload as { companyId?: string; channel?: string }
  const to = String(payload.to ?? '').trim()
  const subject = String(payload.subject ?? '').trim().slice(0, 200)
  const body = String(payload.body ?? '').trim().slice(0, 10_000)
  if (!companyId || (channel !== 'email' && channel !== 'whatsapp')) {
    return NextResponse.json({ error: 'companyId y channel son requeridos' }, { status: 400 })
  }
  if (!body) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })

  // Documentos con el cliente de sesión: la RLS decide qué puede ver.
  const { data: rows, error: qErr } = await supabase.from('invoices').select(INVOICE_SELECT)
    .eq('company_id', companyId).in('status', ['pendiente', 'parcial'])
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  const statement = buildStatement((rows ?? []) as unknown as Invoice[], chileDateString())
  if (statement.lines.length === 0) {
    return NextResponse.json({ error: 'El cliente no tiene documentos con saldo pendiente' }, { status: 400 })
  }

  let destino = to
  if (channel === 'email') {
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Correo de destino no válido' }, { status: 400 })
    if (!subject) return NextResponse.json({ error: 'Falta el asunto' }, { status: 400 })

    // 1° la cuenta conectada del ejecutivo; 2° el correo del sistema (Resend).
    const { data: account } = await supabase.from('email_accounts')
      .select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()

    if (account) {
      const sent = await sendAsUser(supabase, user.id, { to, subject, body })
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status })

      // Historial de correos (enlazado al contacto si existe en la empresa).
      const { data: contact } = await supabase.from('contacts').select('id')
        .eq('company_id', companyId).ilike('email', to).limit(1).maybeSingle()
      await sent.svc.from('email_messages').insert({
        organization_id: organizationId, deal_id: null, contact_id: contact?.id ?? null,
        email_account_id: sent.accountId, direction: 'outbound',
        subject, body_text: body, body_html: null,
        from_address: sent.fromAddress, to_addresses: [to],
        provider_message_id: sent.messageId, thread_id: sent.threadId,
        sent_at: new Date().toISOString(),
      })
    } else if (systemMailConfigured()) {
      const [{ data: me }, { data: org }] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
        supabase.from('organizations').select('name, display_name').eq('id', organizationId).maybeSingle(),
      ])
      const sent = await sendSystemMail({
        to, subject, body,
        fromName: org?.display_name || org?.name || null,
        replyTo: me?.email ?? null,
      })
      if (!sent.ok) return NextResponse.json({ error: `No se pudo enviar: ${sent.error}` }, { status: 502 })
    } else {
      return NextResponse.json({ error: 'No hay correo configurado: conecta tu cuenta en Configuración o pide al administrador activar el correo del sistema.' }, { status: 400 })
    }
    destino = to
  }

  const resumen = `${statement.lines.length} ${statement.lines.length === 1 ? 'documento' : 'documentos'}, total ${clp(statement.total)}`
  const notes = channel === 'email'
    ? `Envió estado de cuenta por correo a ${destino} (${resumen}).\nAsunto: ${subject}`
    : `Envió cobro por WhatsApp${destino ? ` al ${destino}` : ''} (${resumen}).`

  const { error: actErr } = await supabase.from('invoice_activities').insert(
    statement.lines.map(l => ({ invoice_id: l.id, kind: channel, notes }))
  )
  if (actErr) {
    return NextResponse.json({
      ok: channel === 'email', error: channel === 'email' ? undefined : actErr.message,
      warning: channel === 'email' ? 'El correo se envió, pero no se pudo registrar la gestión.' : undefined,
    }, { status: channel === 'email' ? 200 : 500 })
  }
  return NextResponse.json({ ok: true, documents: statement.lines.length })
}
