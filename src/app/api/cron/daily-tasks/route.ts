import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Cron: 8:00 AM Chile (UTC-3) = 11:00 UTC
// vercel.json: "schedule": "0 11 * * *"

const priorityLabel: Record<string, string> = {
  alta:  '🔴 Alta',
  media: '🟡 Media',
  baja:  '🟢 Baja',
}

function emailTemplate(userName: string, tasks: any[], overdue: any[]): string {
  const today = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
        <strong style="color:#1e293b;">${t.title}</strong>
        ${t.deals?.companies?.name ? `<br><span style="color:#94a3b8;font-size:12px;">${t.deals.companies.name}</span>` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">
        <span style="font-size:12px;">${priorityLabel[t.priority ?? 'media'] ?? '🟡 Media'}</span>
      </td>
    </tr>
  `).join('')

  const overdueRows = overdue.map(t => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #fff1f2;">
        <strong style="color:#991b1b;">${t.title}</strong>
        ${t.deals?.companies?.name ? `<br><span style="color:#f87171;font-size:12px;">${t.deals.companies.name}</span>` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #fff1f2;white-space:nowrap;font-size:12px;color:#ef4444;">
        Vencida el ${new Date(t.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:18px;">⚡</span>
        </div>
        <span style="color:white;font-weight:700;font-size:18px;">CRM Automatizaciones</span>
      </div>
      <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 4px;">Buenos días, ${userName} 👋</h1>
      <p style="color:#94a3b8;margin:0;font-size:14px;">${today}</p>
    </div>

    ${overdue.length > 0 ? `
    <!-- Tareas vencidas -->
    <div style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;padding:4px;margin-bottom:20px;">
      <div style="padding:16px 16px 8px;">
        <p style="margin:0;font-weight:700;color:#991b1b;font-size:14px;">⚠️ ${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}</p>
        <p style="margin:4px 0 0;color:#ef4444;font-size:12px;">Estas tareas pasaron su fecha límite y siguen pendientes</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">${overdueRows}</table>
    </div>
    ` : ''}

    ${tasks.length > 0 ? `
    <!-- Tareas para hoy -->
    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:4px;margin-bottom:20px;">
      <div style="padding:16px 16px 8px;">
        <p style="margin:0;font-weight:700;color:#1e293b;font-size:14px;">📋 ${tasks.length} tarea${tasks.length > 1 ? 's' : ''} para hoy</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">Estas tareas vencen hoy o mañana</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">${taskRows}</table>
    </div>
    ` : `
    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;font-size:32px;">🎉</p>
      <p style="margin:8px 0 0;font-weight:700;color:#1e293b;">¡Sin tareas pendientes!</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Tienes el día libre de tareas urgentes</p>
    </div>
    `}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-automatizaciones.vercel.app'}/tareas"
        style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:14px;">
        Ver mis tareas en el CRM →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:0;">
      CRM Automatizaciones · Este correo se envía automáticamente cada mañana
    </p>
  </div>
</body>
</html>
  `
}

export async function GET(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
  // Verificar secret para evitar llamadas no autorizadas
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString()

    // Obtener todos los usuarios activos con email
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .not('email', 'is', null)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No active profiles found' })
    }

    let sent = 0
    const errors: string[] = []

    for (const profile of profiles) {
      if (!profile.email) continue

      // Tareas para hoy/mañana (no completadas)
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('id, title, due_date, priority, deals(companies(name))')
        .eq('assigned_to', profile.id)
        .eq('is_completed', false)
        .gte('due_date', todayStart)
        .lt('due_date', tomorrowEnd)
        .order('due_date', { ascending: true })

      // Tareas vencidas
      const { data: overdue } = await supabaseAdmin
        .from('tasks')
        .select('id, title, due_date, priority, deals(companies(name))')
        .eq('assigned_to', profile.id)
        .eq('is_completed', false)
        .lt('due_date', todayStart)
        .order('due_date', { ascending: true })
        .limit(5)

      // Solo enviar si hay algo pendiente
      if ((tasks?.length ?? 0) === 0 && (overdue?.length ?? 0) === 0) continue

      const userName = profile.full_name?.split(' ')[0] ?? 'equipo'
      const html = emailTemplate(userName, tasks ?? [], overdue ?? [])

      const totalCount = (tasks?.length ?? 0) + (overdue?.length ?? 0)
      const subject = overdue && overdue.length > 0
        ? `⚠️ ${overdue.length} vencida${overdue.length > 1 ? 's' : ''} + ${tasks?.length ?? 0} para hoy — CRM`
        : `📋 Tienes ${totalCount} tarea${totalCount > 1 ? 's' : ''} para hoy — CRM`

      const { error } = await resend.emails.send({
        from:    'CRM Automatizaciones <noreply@autopilot.cl>',
        to:      [profile.email],
        subject,
        html,
      })

      if (error) {
        errors.push(`${profile.email}: ${error.message}`)
      } else {
        sent++
      }
    }

    return NextResponse.json({
      ok:     true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('Cron daily-tasks error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
