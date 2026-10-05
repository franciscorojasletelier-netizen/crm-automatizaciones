// Solicitudes de factura al contador (migración 060). Solo servidor.
//
// Destinatarios: usuarios activos con rol Finanzas de la organización y/o
// el correo del contador externo (Configuración → Datos de la empresa).
// Si el contador usa el CRM, la tarea "Emitir factura" pasa a su nombre.
// Si no hay a quién enviar, la tarea del vendedor le recuerda mandar los
// datos (botón «Enviar al contador» en la ficha del negocio).
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { renderBillingRequestEmail, billingConcept, type BillingClient, type BillingRequestData } from '@/lib/billing-email'
import { money } from '@/lib/money'

export interface BillingRequestRow {
  id: string; organization_id: string; deal_id: string | null; quote_id: string | null; task_id: string | null
  installment: number; installments: number; label: string | null; amount: number; currency: string; status: string
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://crm-automatizaciones.vercel.app'

/** Datos para el correo (cliente, cotización, firmante, desglose). */
export async function loadBillingContext(svc: SupabaseClient, req: BillingRequestRow) {
  const [{ data: org }, { data: deal }, { data: quote }, { data: finance }] = await Promise.all([
    svc.from('organizations').select('name, display_name, logo_url, email, phone, address, accounting_email').eq('id', req.organization_id).maybeSingle(),
    req.deal_id
      ? svc.from('deals').select('id, owner_id, company_id, companies(name, legal_name, tax_id, business_activity, billing_address, billing_email), profiles:owner_id(full_name, email)').eq('id', req.deal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    req.quote_id
      ? svc.from('quotes').select('quote_number, public_token, accepted_snapshot').eq('id', req.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from('profiles').select('id, email, full_name').eq('organization_id', req.organization_id).eq('role', 'finanzas').eq('is_active', true),
  ])
  const company = (deal?.companies ?? null) as unknown as { name: string | null; legal_name: string | null; tax_id: string | null; business_activity: string | null; billing_address: string | null; billing_email: string | null } | null
  const owner = (deal?.profiles ?? null) as unknown as { full_name: string | null; email: string | null } | null
  const snap = (quote?.accepted_snapshot ?? null) as { subtotal?: number; total?: number; impuestos?: { nombre: string; tasa: number }[]; aceptacion?: { nombre: string; rut: string }; cliente?: { facturacion?: Partial<BillingClient> } } | null
  const billing = snap?.cliente?.facturacion
  const client: BillingClient = {
    company: company?.name ?? null,
    legalName: company?.legal_name || billing?.legalName || null,
    taxId: company?.tax_id || billing?.taxId || null,
    activity: company?.business_activity || billing?.activity || null,
    address: company?.billing_address || billing?.address || null,
    billingEmail: company?.billing_email || billing?.billingEmail || null,
  }
  const data: BillingRequestData = {
    quoteNumber: quote?.quote_number ?? 0,
    installment: req.installment, installments: req.installments, label: req.label,
    amount: Number(req.amount), currency: req.currency,
    netRatio: snap?.subtotal && snap?.total ? snap.subtotal / snap.total : null,
    taxLines: (snap?.impuestos ?? []).map(t => ({ name: t.nombre, rate: t.tasa })),
    signer: snap?.aceptacion ? { name: snap.aceptacion.nombre, rut: snap.aceptacion.rut } : null,
    sellerName: owner?.full_name ?? null,
  }
  const brand = { name: org?.display_name || org?.name || 'CRM', logoUrl: org?.logo_url, email: org?.email, phone: org?.phone, address: org?.address }
  const params = new URLSearchParams({ nuevo: '1', concepto: `${billingConcept(data)}${client.company ? ` — ${client.company}` : ''}`, monto: String(data.amount) })
  if (deal?.id) params.set('deal', deal.id)
  if (deal?.company_id) params.set('empresa', deal.company_id)
  if (req.quote_id) params.set('cotizacion', req.quote_id)
  return {
    org, deal, owner, client, data, brand,
    financeUsers: (finance ?? []) as { id: string; email: string | null; full_name: string | null }[],
    registerLink: `${appUrl()}/cobranza?${params}`,
    certificateLink: quote?.public_token && snap ? `${appUrl()}/cotizacion/${quote.public_token}/comprobante` : null,
  }
}

async function appendTaskNote(svc: SupabaseClient, taskId: string | null, note: string, reassignTo?: string) {
  if (!taskId) return
  const { data: task } = await svc.from('tasks').select('description').eq('id', taskId).maybeSingle()
  await svc.from('tasks').update({
    description: `${task?.description ? `${task.description}\n` : ''}${note}`,
    ...(reassignTo ? { assigned_to: reassignTo } : {}),
  }).eq('id', taskId)
}

/** Envía la solicitud al contador (o deja el recordatorio al vendedor). */
export async function processBillingRequest(svc: SupabaseClient, req: BillingRequestRow): Promise<'sent' | 'no_recipient' | 'failed'> {
  const ctx = await loadBillingContext(svc, req)
  const recipients = [...new Set([
    ...ctx.financeUsers.map(u => u.email).filter(Boolean) as string[],
    ...(ctx.org?.accounting_email ? [ctx.org.accounting_email] : []),
  ].map(e => e.toLowerCase()))]
  const concept = billingConcept(ctx.data)
  const amount = money(ctx.data.amount, ctx.data.currency)

  if (recipients.length === 0 || !systemMailConfigured()) {
    await appendTaskNote(svc, req.task_id, 'No hay contador registrado en el CRM: usa «Enviar al contador» en la ficha del negocio (panel Cobranza) para mandarle los datos de facturación.')
    await svc.from('billing_requests').update({ status: 'no_recipient', processed_at: new Date().toISOString() }).eq('id', req.id)
    return 'no_recipient'
  }

  const mail = renderBillingRequestEmail({ data: ctx.data, client: ctx.client, brand: ctx.brand, registerLink: ctx.registerLink, certificateLink: ctx.certificateLink })
  let ok = 0
  for (const to of recipients) {
    const res = await sendSystemMail({ to, subject: mail.subject, body: mail.text, html: mail.html, fromName: ctx.brand.name, replyTo: ctx.owner?.email ?? null })
    if (res.ok) ok++
  }
  if (ok === 0) {
    await svc.from('billing_requests').update({ status: 'failed', processed_at: new Date().toISOString() }).eq('id', req.id)
    return 'failed'
  }

  // El contador que usa el CRM queda a cargo de la tarea; el vendedor recibe aviso.
  const financeUser = ctx.financeUsers[0]
  await appendTaskNote(svc, req.task_id, `Solicitud de factura enviada a ${recipients.join(', ')}.`, financeUser?.id)
  const notify = [
    ...ctx.financeUsers.map(u => ({ user_id: u.id, title: `Emitir factura — ${ctx.client.company ?? 'Cliente'}`, body: `${concept}: ${amount}.` })),
    ...(ctx.deal?.owner_id && !ctx.financeUsers.some(u => u.id === ctx.deal!.owner_id)
      ? [{ user_id: ctx.deal.owner_id as string, title: `Factura solicitada al contador — ${ctx.client.company ?? 'Cliente'}`, body: `${concept}: ${amount}. Enviada a ${recipients.join(', ')}.` }]
      : []),
  ]
  if (notify.length) {
    await svc.from('notifications').insert(notify.map(n => ({ ...n, type: 'billing_milestone', entity_type: 'deal', entity_id: ctx.deal?.id ?? null })))
  }
  await svc.from('billing_requests').update({ status: 'sent', sent_to: recipients, processed_at: new Date().toISOString() }).eq('id', req.id)
  return 'sent'
}

/** Envío manual a un correo (botón «Enviar al contador» del negocio). */
export async function sendBillingRequestTo(svc: SupabaseClient, req: BillingRequestRow, to: string, replyTo: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!systemMailConfigured()) return { ok: false, error: 'El correo del sistema no está configurado' }
  const ctx = await loadBillingContext(svc, req)
  const mail = renderBillingRequestEmail({ data: ctx.data, client: ctx.client, brand: ctx.brand, registerLink: ctx.registerLink, certificateLink: ctx.certificateLink })
  const res = await sendSystemMail({ to, subject: mail.subject, body: mail.text, html: mail.html, fromName: ctx.brand.name, replyTo })
  if (!res.ok) return { ok: false, error: res.error }
  await appendTaskNote(svc, req.task_id, `Solicitud de factura enviada a ${to}.`)
  await svc.from('billing_requests').update({ status: 'sent', sent_to: [to], processed_at: new Date().toISOString() }).eq('id', req.id)
  return { ok: true }
}
