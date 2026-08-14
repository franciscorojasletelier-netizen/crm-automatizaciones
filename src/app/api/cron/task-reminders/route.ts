import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

function buildEmailHtml(orgName: string, now: Date, todayTasks: any[], overdueTasks: any[]) {
  const todayHtml = todayTasks.length > 0 ? `
    <h3 style="color:#111;font-size:14px;margin:0 0 8px;">📋 Tareas para hoy (${todayTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${todayTasks.map(t => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${t.title}</td>
          <td style="padding:8px 0;font-size:12px;color:#888;text-align:right;">${t.deals?.companies?.name ?? ''}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  const overdueHtml = overdueTasks.length > 0 ? `
    <h3 style="color:#dc2626;font-size:14px;margin:0 0 8px;">⚠️ Tareas vencidas (${overdueTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${overdueTasks.map(t => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${t.title}</td>
          <td style="padding:8px 0;font-size:12px;color:#dc2626;text-align:right;">${formatDate(t.due_date)}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h2 style="color:#111;margin:0 0 4px;">Buenos días 👋</h2>
      <p style="color:#666;font-size:14px;margin:0 0 24px;">
        ${orgName} — ${now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET?.trim()}`) {
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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const yesterday  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

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
      .lt('due_date', yesterday)
      .order('due_date', { ascending: false })
      .limit(10)

    if ((!todayTasks || todayTasks.length === 0) && (!overdueTasks || overdueTasks.length === 0)) continue

    const orgName = org.display_name || org.name
    await resend.emails.send({
      from: process.env.EMAIL_FROM?.trim() || 'CRM Automatizaciones <onboarding@resend.dev>',
      to: org.notification_email!,
      subject: `📅 ${todayTasks?.length ?? 0} tarea${(todayTasks?.length ?? 0) !== 1 ? 's' : ''} para hoy — ${orgName}`,
      html: buildEmailHtml(orgName, now, todayTasks ?? [], overdueTasks ?? []),
    })
    sent++
  }

  return NextResponse.json({ status: 'ok', organizationsNotified: sent, organizationsChecked: orgs?.length ?? 0 })
}
