import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { CHILE_TZ, chileDayStart } from '@/lib/dates'
import { escapeHtml } from '@/lib/html'

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: '2-digit', month: 'short' })

type ReminderTask = { title: string; due_date: string; deals: { companies: { name: string | null } | null } | null }

function buildEmailHtml(orgName: string, now: Date, todayTasks: ReminderTask[], overdueTasks: ReminderTask[]) {
  const todayHtml = todayTasks.length > 0 ? `
    <h3 style="color:#111;font-size:14px;margin:0 0 8px;">📋 Tareas para hoy (${todayTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${todayTasks.map(t => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${escapeHtml(t.title)}</td>
          <td style="padding:8px 0;font-size:12px;color:#888;text-align:right;">${escapeHtml(t.deals?.companies?.name)}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  const overdueHtml = overdueTasks.length > 0 ? `
    <h3 style="color:#dc2626;font-size:14px;margin:0 0 8px;">⚠️ Tareas vencidas (${overdueTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${overdueTasks.map(t => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${escapeHtml(t.title)}</td>
          <td style="padding:8px 0;font-size:12px;color:#dc2626;text-align:right;">${formatDate(t.due_date)}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h2 style="color:#111;margin:0 0 4px;">Buenos días 👋</h2>
      <p style="color:#666;font-size:14px;margin:0 0 24px;">
        ${escapeHtml(orgName)} — ${now.toLocaleDateString('es-CL', { timeZone: CHILE_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      ${todayHtml}
      ${overdueHtml}
      <a href="https://crm-automatizaciones.vercel.app/tareas"
         style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:bold;">
        Ver tareas en el CRM →
      </a>
      <p style="color:#ccc;font-size:11px;margin-top:24px;">Este email se envía automáticamente cada día a las 8:00 AM</p>
    </div>
  `
}

export async function GET(request: NextRequest) {
  // Falla cerrado: si CRON_SECRET no está seteada, el endpoint queda
  // público en vez de protegido — mismo guard que los otros 3 crons
  // (antes este era el único que no lo tenía).
  const authHeader = request.headers.get('authorization')
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim()
  )
  const resend = new Resend(process.env.RESEND_API_KEY?.trim())

  // Antes: un único destinatario hardcodeado (autopilotspa@gmail.com).
  // Ahora: cada organización que configuró un email de notificaciones
  // recibe SU PROPIO resumen, acotado a sus propias tareas.
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, display_name, notification_email')
    .eq('is_active', true)
    .not('notification_email', 'is', null)

  const now = new Date()
  // Días calendario de Chile, no de UTC (el servidor corre en UTC)
  const todayStart = chileDayStart(0, now).toISOString()
  const todayEnd   = chileDayStart(1, now).toISOString()

  let sent = 0
  for (const org of orgs ?? []) {
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, deals(companies(name))')
      .eq('organization_id', org.id)
      .eq('is_completed', false)
      .gte('due_date', todayStart)
      .lt('due_date', todayEnd)
      .order('due_date', { ascending: true })

    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, deals(companies(name))')
      .eq('organization_id', org.id)
      .eq('is_completed', false)
      .lt('due_date', todayStart)  // vencida = antes de hoy; antes era "antes de ayer" y las de ayer no salían en ninguna lista
      .order('due_date', { ascending: false })
      .limit(10)

    if ((!todayTasks || todayTasks.length === 0) && (!overdueTasks || overdueTasks.length === 0)) continue

    const orgName = org.display_name || org.name
    await resend.emails.send({
      from: process.env.EMAIL_FROM?.trim() || 'CRM Automatizaciones <onboarding@resend.dev>',
      to: org.notification_email!,
      subject: `📅 ${todayTasks?.length ?? 0} tarea${(todayTasks?.length ?? 0) !== 1 ? 's' : ''} para hoy — ${orgName}`,
      // deals(companies(name)) es a-uno; sin tipos de base se infiere como arreglo.
      html: buildEmailHtml(orgName, now, (todayTasks ?? []) as unknown as ReminderTask[], (overdueTasks ?? []) as unknown as ReminderTask[]),
    })
    sent++
  }

  return NextResponse.json({ status: 'ok', organizationsNotified: sent, organizationsChecked: orgs?.length ?? 0 })
}

// pg_cron llama vía POST (net.http_post) — mismo handler que GET, que
// se mantiene para poder disparar el cron a mano desde el navegador.
export const POST = GET
