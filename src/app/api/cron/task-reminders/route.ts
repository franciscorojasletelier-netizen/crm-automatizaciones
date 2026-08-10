import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function GET(request: NextRequest) {
  // Verificar que viene de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET?.trim()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim()
  )
  const resend = new Resend(process.env.RESEND_API_KEY?.trim())

  const RECIPIENT = 'autopilotspa@gmail.com'

  // Este cron manda un único email a un destinatario fijo — hay que
  // acotar las tareas a la organización de ese destinatario, si no,
  // con service_role (que evita RLS) filtraría tareas de TODAS las
  // organizaciones del sistema en un solo correo.
  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('email', RECIPIENT)
    .maybeSingle()

  const orgId = (recipientProfile as any)?.organization_id ?? null
  if (!orgId) {
    return NextResponse.json({ status: 'ok', sent: false, reason: 'Destinatario sin organización asignada' })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const yesterday  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

  // Tareas de hoy
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, deals(companies(name))')
    .eq('organization_id', orgId)
    .eq('is_completed', false)
    .gte('due_date', todayStart)
    .lt('due_date', todayEnd)
    .order('due_date', { ascending: true })

  // Tareas vencidas (de ayer hacia atrÃ¡s)
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, deals(companies(name))')
    .eq('organization_id', orgId)
    .eq('is_completed', false)
    .lt('due_date', yesterday)
    .order('due_date', { ascending: false })
    .limit(10)

  if ((!todayTasks || todayTasks.length === 0) && (!overdueTasks || overdueTasks.length === 0)) {
    return NextResponse.json({ status: 'ok', sent: false, reason: 'No hay tareas para hoy ni vencidas' })
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

  const todayHtml = todayTasks && todayTasks.length > 0 ? `
    <h3 style="color:#111;font-size:14px;margin:0 0 8px;">ðŸ“‹ Tareas para hoy (${todayTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${todayTasks.map((t: any) => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${t.title}</td>
          <td style="padding:8px 0;font-size:12px;color:#888;text-align:right;">${(t as any).deals?.companies?.name ?? ''}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  const overdueHtml = overdueTasks && overdueTasks.length > 0 ? `
    <h3 style="color:#dc2626;font-size:14px;margin:0 0 8px;">âš ï¸ Tareas vencidas (${overdueTasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${overdueTasks.map((t: any) => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 0;font-size:13px;color:#111;">${t.title}</td>
          <td style="padding:8px 0;font-size:12px;color:#dc2626;text-align:right;">${formatDate(t.due_date)}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''

  await resend.emails.send({
    from: process.env.EMAIL_FROM?.trim() || 'CRM Autopilot <onboarding@resend.dev>',
    to: RECIPIENT,
    subject: `ðŸ“… ${todayTasks?.length ?? 0} tarea${(todayTasks?.length ?? 0) !== 1 ? 's' : ''} para hoy â€” ${now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
        <h2 style="color:#111;margin:0 0 4px;">Buenos dÃ­as ðŸ‘‹</h2>
        <p style="color:#666;font-size:14px;margin:0 0 24px;">
          ${now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        ${todayHtml}
        ${overdueHtml}
        <a href="https://crm-automatizaciones.vercel.app/tareas"
           style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:bold;">
          Ver tareas en el CRM â†’
        </a>
        <p style="color:#ccc;font-size:11px;margin-top:24px;">Este email se envÃ­a automÃ¡ticamente cada dÃ­a a las 8:00 AM</p>
      </div>
    `,
  })

  return NextResponse.json({ status: 'ok', sent: true, today: todayTasks?.length ?? 0, overdue: overdueTasks?.length ?? 0 })
}

