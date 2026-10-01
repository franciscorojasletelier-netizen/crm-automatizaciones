// ============================================================
//  Recordatorios automáticos de cobranza al cliente.
//
//  Hitos por documento: N días antes del vencimiento, el día del
//  vencimiento y a los N días de mora. Cada hito tiene una ventana de
//  gracia (si el cron falla un día, igual sale al siguiente) y se envía
//  una sola vez (tabla invoice_reminders). Un correo por cliente y día,
//  con el estado de cuenta completo. Sale por el correo del sistema.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { chileDateString } from '@/lib/dates'
import { INVOICE_SELECT, daysBetween, type Invoice } from '@/lib/cobranza'
import { buildStatement, emailMessage, suggestedTone, type Tone } from '@/lib/cobranza-mensajes'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'
import { renderCollectionEmail } from '@/lib/cobranza-email'

export interface ReminderSettings {
  organization_id: string
  auto_reminders: boolean
  days_before: number
  on_due_date: boolean
  days_after: number[]
}

export const DEFAULT_SETTINGS: Omit<ReminderSettings, 'organization_id'> = {
  auto_reminders: false, days_before: 3, on_due_date: true, days_after: [7, 15, 30],
}

const GRACE_DAYS = 2

export const MILESTONE_LABEL = (m: string) =>
  m === 'antes' ? 'antes del vencimiento' : m === 'vence' ? 'día del vencimiento' : `${m.replace('mora_', '')} días de mora`

/** Hito que corresponde hoy a un documento abierto, o null. */
export function milestoneFor(inv: Pick<Invoice, 'due_date'>, today: string, s: Omit<ReminderSettings, 'organization_id'>): string | null {
  const until = daysBetween(today, inv.due_date) // > 0: faltan días · < 0: días de atraso
  // Antes: desde N días antes, con margen si el cron no corrió.
  if (s.days_before > 0 && until > 0 && until <= s.days_before && until >= s.days_before - GRACE_DAYS) return 'antes'
  // Día del vencimiento (o hasta GRACE_DAYS después si se saltó).
  if (s.on_due_date && until <= 0 && until >= -GRACE_DAYS) return 'vence'
  // Mora: el mayor hito alcanzado, solo dentro de su ventana (no se
  // envía de golpe toda la deuda antigua al activar los recordatorios).
  const late = -until
  const hit = [...s.days_after].sort((x, y) => y - x).find(n => late >= n && late <= n + GRACE_DAYS)
  return hit ? `mora_${hit}` : null
}

/** Correos que no se pueden entregar (datos de prueba o reservados). */
export function deliverable(email: string | null | undefined): email is string {
  if (!email) return false
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  return !/\.(invalid|test|example|localhost)$/.test(e) && !/@example\.(com|org|net)$/.test(e)
}

export interface PlannedReminder {
  companyId: string
  companyName: string
  to: string | null
  contactName: string | null
  invoices: { id: string; milestone: string }[]
  tone: Tone
  skipped?: 'sin_correo' | 'correo_no_entregable'
}

/**
 * Qué se enviaría hoy en una organización (sin enviar). Lo usa el cron y
 * la vista previa de la configuración.
 */
export async function planReminders(db: SupabaseClient, organizationId: string, s: Omit<ReminderSettings, 'organization_id'>, today = chileDateString()) {
  const { data: rows } = await db.from('invoices').select(INVOICE_SELECT)
    .eq('organization_id', organizationId).in('status', ['pendiente', 'parcial'])
  const invoices = (rows ?? []) as unknown as Invoice[]

  const due = invoices.map(inv => ({ inv, milestone: milestoneFor(inv, today, s) })).filter(x => x.milestone) as { inv: Invoice; milestone: string }[]
  if (due.length === 0) return { plan: [] as PlannedReminder[], invoices }

  const { data: sent } = await db.from('invoice_reminders').select('invoice_id, milestone')
    .in('invoice_id', due.map(d => d.inv.id))
  const sentKey = new Set((sent ?? []).map(r => `${r.invoice_id}:${r.milestone}`))
  const pending = due.filter(d => !sentKey.has(`${d.inv.id}:${d.milestone}`))

  const companyIds = [...new Set(pending.map(p => p.inv.company_id))]
  const { data: contacts } = companyIds.length
    ? await db.from('contacts').select('company_id, full_name, email, created_at').in('company_id', companyIds).order('created_at')
    : { data: [] }
  const contactBy = new Map<string, { full_name: string | null; email: string | null }>()
  for (const c of (contacts ?? []) as { company_id: string; full_name: string | null; email: string | null }[]) {
    const prev = contactBy.get(c.company_id)
    if (!prev || (!deliverable(prev.email) && deliverable(c.email))) contactBy.set(c.company_id, c)
  }

  const plan: PlannedReminder[] = companyIds.map(companyId => {
    const items = pending.filter(p => p.inv.company_id === companyId)
    const contact = contactBy.get(companyId)
    const statement = buildStatement(invoices.filter(i => i.company_id === companyId), today)
    return {
      companyId,
      companyName: items[0].inv.companies?.name ?? 'Cliente',
      to: contact?.email ?? null,
      contactName: contact?.full_name ?? null,
      invoices: items.map(i => ({ id: i.inv.id, milestone: i.milestone })),
      tone: statement.maxDaysLate > 0 ? suggestedTone(statement) : 'recordatorio',
      skipped: !contact?.email ? 'sin_correo' : !deliverable(contact.email) ? 'correo_no_entregable' : undefined,
    }
  })
  return { plan, invoices }
}

/** Ejecuta los recordatorios de todas las organizaciones activas (cron). */
export async function runCollectionReminders(svc: SupabaseClient, today = chileDateString()) {
  if (!systemMailConfigured()) return { status: 'sin_correo_del_sistema' as const, sent: 0 }

  const { data: settingsRows } = await svc.from('collection_settings').select('*').eq('auto_reminders', true)
  let sent = 0, skipped = 0, failed = 0

  for (const s of (settingsRows ?? []) as ReminderSettings[]) {
    const [{ plan, invoices }, { data: org }] = await Promise.all([
      planReminders(svc, s.organization_id, s, today),
      svc.from('organizations').select('name, display_name, email, phone, address, logo_url, payment_instructions, notification_email, is_active').eq('id', s.organization_id).maybeSingle(),
    ])
    if (!org?.is_active) continue
    const orgName = org.display_name || org.name

    for (const p of plan.slice(0, 100)) {
      if (p.skipped || !p.to) { skipped++; continue }
      const statement = buildStatement(invoices.filter(i => i.company_id === p.companyId), today)
      const lead = invoices.find(i => i.id === p.invoices[0].id)
      // Respuestas al responsable del documento; si no hay, al correo de la organización.
      const { data: resp } = lead?.responsible_id
        ? await svc.from('profiles').select('email').eq('id', lead.responsible_id).maybeSingle()
        : { data: null }
      const replyTo = resp?.email || org.notification_email || org.email || null

      const msg = emailMessage({ statement, tone: p.tone, companyName: p.companyName, contactName: p.contactName, senderName: null, orgName })
      const mail = renderCollectionEmail({
        body: msg.body, subject: msg.subject, statement, tone: p.tone,
        org: { name: orgName, logoUrl: org.logo_url, email: org.email, phone: org.phone, address: org.address, paymentInstructions: org.payment_instructions },
      })
      const res = await sendSystemMail({ to: p.to, subject: msg.subject, body: mail.text, html: mail.html, fromName: orgName, replyTo })
      if (!res.ok) { failed++; continue }
      sent++

      await svc.from('invoice_reminders').insert(p.invoices.map(i => ({
        organization_id: s.organization_id, invoice_id: i.id, milestone: i.milestone, sent_to: p.to!,
      })))
      await svc.from('invoice_activities').insert(p.invoices.map(i => ({
        invoice_id: i.id, kind: 'email',
        notes: `Recordatorio automático (${MILESTONE_LABEL(i.milestone)}) enviado a ${p.to}.`,
      })))
    }
  }
  return { status: 'ok' as const, sent, skipped, failed }
}
