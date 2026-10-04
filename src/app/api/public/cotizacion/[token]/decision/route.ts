import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { isValidRut, formatRut } from '@/lib/rut'
import {
  buildAcceptanceSnapshot, canonicalJson, sha256Hex, hashCode, sameHash, CODE_MAX_ATTEMPTS, type QuoteRow,
} from '@/lib/quote-acceptance'
import { renderAcceptanceCertificateEmail } from '@/lib/quote-email'
import { money } from '@/lib/money'
import { nextBusinessDue } from '@/lib/dates'

// Respuesta del cliente a una cotización desde el link público.
// Aceptar = firma electrónica simple reforzada (Ley 19.799): código de un
// solo uso enviado al correo del cliente, nombre, RUT y cargo, aceptación
// expresa de las condiciones de pago, copia exacta de lo aceptado con su
// huella SHA-256, IP y navegador. Luego se envía el comprobante a ambas
// partes y se agenda la emisión de la primera factura.
// Rechazar = motivo opcional.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Endpoint público sin autenticación — freno básico contra abuso/spam.
  const ip = getClientIp(request)
  const { allowed } = await checkRateLimit(supabase, 'quote_decision', ip, { maxHits: 20, windowMinutes: 15 })
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const decision = body.decision as 'accepted' | 'rejected'
  if (!['accepted', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision inválida' }, { status: 400 })
  }

  const { data: quote } = await supabase.from('quotes')
    .select('id, status, quote_number, deal_id, created_by, organization_id, items, taxes, tax_rate, currency, valid_until, notes, created_at, payment_terms, payment_conditions')
    .eq('public_token', token).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  if (quote.status !== 'sent') {
    return NextResponse.json({ error: 'Esta cotización ya fue respondida o no está disponible para responder.' }, { status: 409 })
  }

  const [{ data: deal }, { data: org }] = await Promise.all([
    supabase.from('deals').select('owner_id, companies(name), contacts:primary_contact_id(full_name)').eq('id', quote.deal_id).maybeSingle(),
    supabase.from('organizations').select('name, display_name, logo_url, email, phone, address, notification_email, currency').eq('id', quote.organization_id).maybeSingle(),
  ])
  const company = (deal?.companies as unknown as { name: string } | null)?.name ?? null
  const contact = (deal?.contacts as unknown as { full_name: string | null } | null)?.full_name ?? null
  const orgName = org?.display_name || org?.name || 'Tu proveedor'
  const recipients = [...new Set([deal?.owner_id, quote.created_by].filter(Boolean))] as string[]

  // ── Rechazo ───────────────────────────────────────────────
  if (decision === 'rejected') {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) || null : null
    const { error } = await supabase.from('quotes').update({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason }).eq('id', quote.id)
    if (error) return NextResponse.json({ error: 'No se pudo registrar la respuesta' }, { status: 500 })
    if (recipients.length) {
      await supabase.from('notifications').insert(recipients.map(user_id => ({
        user_id, type: 'quote_rejected', title: `Cotización #${quote.quote_number} rechazada`,
        body: `${company ?? 'El cliente'} la rechazó${reason ? `. Motivo: ${reason}` : ' (sin motivo)'}`,
        entity_type: 'deal', entity_id: quote.deal_id,
      })))
    }
    return NextResponse.json({ ok: true })
  }

  // ── Aceptación con firma reforzada ────────────────────────
  const name = String(body.name ?? '').trim().slice(0, 120)
  const rut = String(body.rut ?? '').trim()
  const role = String(body.role ?? '').trim().slice(0, 80) || null
  const code = String(body.code ?? '').replace(/\D/g, '')
  if (!name) return NextResponse.json({ error: 'Ingresa tu nombre completo' }, { status: 400 })
  if (!isValidRut(rut)) return NextResponse.json({ error: 'El RUT no es válido' }, { status: 400 })
  if (body.acceptTerms !== true) return NextResponse.json({ error: 'Debes aceptar las condiciones de pago' }, { status: 400 })
  if (code.length !== 6) return NextResponse.json({ error: 'Ingresa el código de 6 dígitos que te enviamos por correo' }, { status: 400 })

  const { data: pending } = await supabase.from('quote_acceptance_codes')
    .select('id, email, code_hash, expires_at, attempts')
    .eq('quote_id', quote.id).is('consumed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!pending || Date.parse(pending.expires_at) < Date.now()) {
    return NextResponse.json({ error: 'El código venció. Pide uno nuevo.' }, { status: 400 })
  }
  if (pending.attempts >= CODE_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Demasiados intentos con este código. Pide uno nuevo.' }, { status: 400 })
  }
  if (!sameHash(hashCode(quote.id, code), pending.code_hash)) {
    await supabase.from('quote_acceptance_codes').update({ attempts: pending.attempts + 1 }).eq('id', pending.id)
    return NextResponse.json({ error: 'El código no es correcto' }, { status: 400 })
  }
  await supabase.from('quote_acceptance_codes').update({ consumed_at: new Date().toISOString() }).eq('id', pending.id)

  const acceptedAt = new Date().toISOString()
  const signer = { name, rut: formatRut(rut), role, email: pending.email, ip, userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null }
  const snapshot = buildAcceptanceSnapshot({ quote: quote as QuoteRow, orgName, company, contact, signer, acceptedAt })
  const hash = sha256Hex(canonicalJson(snapshot))

  const { error } = await supabase.from('quotes').update({
    status: 'accepted', accepted_at: acceptedAt, accepted_by_name: name, accepted_ip: ip,
    accepted_rut: signer.rut, accepted_role: role, accepted_email: signer.email, accepted_user_agent: signer.userAgent,
    accepted_snapshot: snapshot, accepted_hash: hash,
  }).eq('id', quote.id).eq('status', 'sent')
  if (error) return NextResponse.json({ error: 'No se pudo registrar la aceptación' }, { status: 500 })

  // Lo que sigue no deshace la aceptación si falla.
  // El valor del negocio pasa a ser lo firmado (dashboard y reportes cuadran con la cotización).
  if ((org?.currency ?? 'CLP') === snapshot.documento.moneda) {
    await supabase.from('deals').update({ estimated_value: snapshot.total }).eq('id', quote.deal_id)
  }
  const firstInstallment = snapshot.plan_de_pagos[0] ?? null
  const cur = snapshot.documento.moneda
  const invoiceNote = firstInstallment
    ? `Factura cuota 1 (${firstInstallment.hito}, ${firstInstallment.porcentaje} %): ${money(firstInstallment.monto, cur)}`
    : `Factura por ${money(snapshot.total, cur)}`

  if (recipients.length) {
    await supabase.from('notifications').insert(recipients.map(user_id => ({
      user_id, type: 'quote_accepted', title: `✅ Cotización #${quote.quote_number} aceptada`,
      body: `${company ?? 'El cliente'} — firmada por ${name} (RUT ${signer.rut}). Emitir: ${invoiceNote}.`,
      entity_type: 'deal', entity_id: quote.deal_id,
    })))
  }
  // Tarea para emitir la primera factura (con su aviso de 5 minutos).
  const assignee = deal?.owner_id ?? quote.created_by
  if (assignee) {
    await supabase.from('tasks').insert({
      organization_id: quote.organization_id, deal_id: quote.deal_id, assigned_to: assignee, created_by: assignee,
      title: `Emitir factura cuota 1 — Cotización #${quote.quote_number}${company ? ` (${company})` : ''}`,
      description: `${invoiceNote}.\nEl cliente aceptó la cotización y se le informó que la factura se emitirá en las próximas horas hábiles.`,
      due_date: nextBusinessDue().toISOString(),
    })
  }

  // Comprobante a ambas partes.
  if (systemMailConfigured()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
    const brand = { name: orgName, logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address }
    const mail = renderAcceptanceCertificateEmail({ snapshot, hash, link: `${appUrl}/cotizacion/${token}/comprobante`, brand, invoiceNote: firstInstallment ? invoiceNote : null })
    const { data: staff } = recipients.length ? await supabase.from('profiles').select('email').in('id', recipients) : { data: [] }
    const internal = [...new Set([org?.notification_email, ...(staff ?? []).map(p => p.email)].filter(Boolean))] as string[]
    for (const to of [signer.email, ...internal.filter(e => e.toLowerCase() !== signer.email.toLowerCase())]) {
      await sendSystemMail({ to, subject: mail.subject, body: mail.text, html: mail.html, fromName: orgName, replyTo: org?.email ?? null })
    }
  }

  return NextResponse.json({ ok: true, hash, invoiceNote: firstInstallment ? invoiceNote : null })
}
