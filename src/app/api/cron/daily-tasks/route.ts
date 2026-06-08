import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron: 8:00 AM Chile (UTC-3) = 11:00 UTC
// vercel.json: "schedule": "0 11 * * *"

export async function GET(request: NextRequest) {
  // Verificar authorization (solo si CRON_SECRET está definido y sin espacios)
  const authHeader = request.headers.get('authorization')
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey  = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const resendKey    = process.env.RESEND_API_KEY
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-automatizaciones.vercel.app'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const now        = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const tomorrowEnd= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString()

    // Obtener todos los usuarios activos con email
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)

    if (profErr || !profiles) {
      return NextResponse.json({ error: 'Could not fetch profiles', detail: profErr?.message }, { status: 500 })
    }

    let sent = 0
    const errors: string[] = []

    for (const profile of profiles) {
      if (!profile.email) continue

      // Tareas para hoy/mañana
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, deals(companies(name))')
        .eq('assigned_to', profile.id)
        .eq('is_completed', false)
        .gte('due_date', todayStart)
        .lt('due_date', tomorrowEnd)
        .order('due_date', { ascending: true })

      // Tareas vencidas
      const { data: overdue } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, deals(companies(name))')
        .eq('assigned_to', profile.id)
        .eq('is_completed', false)
        .lt('due_date', todayStart)
        .order('due_date', { ascending: true })
        .limit(5)

      const taskList   = tasks   ?? []
      const overdueList= overdue ?? []

      if (taskList.length === 0 && overdueList.length === 0) continue

      const userName = (profile.full_name ?? '').split(' ')[0] || 'equipo'
      const subject  = overdueList.length > 0
        ? `⚠️ ${overdueList.length} tarea(s) vencida(s) — CRM`
        : `📋 Tienes ${taskList.length} tarea(s) para hoy — CRM`

      const html = buildEmailHtml(userName, taskList, overdueList, appUrl)

      if (!resendKey) {
        // Sin API key, solo loguear
        console.log(`[CRON] Would email ${profile.email}: ${subject}`)
        sent++
        continue
      }

      // Enviar con Resend via fetch (evita problemas de importación)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'CRM Automatizaciones <noreply@autopilot.cl>',
          to:      [profile.email],
          subject,
          html,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        errors.push(`${profile.email}: ${errText}`)
      } else {
        sent++
      }
    }

    return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Template de email ────────────────────────────────────────────
function buildEmailHtml(
  userName: string,
  tasks: Record<string, unknown>[],
  overdue: Record<string, unknown>[],
  appUrl: string
): string {
  const today = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const priorityEmoji: Record<string, string> = { alta: '🔴', media: '🟡', baja: '🟢' }

  const row = (t: Record<string, unknown>, isOverdue: boolean) => {
    const title    = String(t.title ?? '')
    const company  = (t.deals as Record<string, unknown> | null)?.companies
    const compName = (company as Record<string, unknown> | null)?.name
    const priority = String(t.priority ?? 'media')
    const dueDate  = t.due_date ? new Date(String(t.due_date)).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : ''

    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid ${isOverdue ? '#fff1f2' : '#f1f5f9'};">
        <strong style="color:${isOverdue ? '#991b1b' : '#1e293b'}">${title}</strong>
        ${compName ? `<br><span style="color:#94a3b8;font-size:12px">${String(compName)}</span>` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid ${isOverdue ? '#fff1f2' : '#f1f5f9'};font-size:12px;white-space:nowrap;color:${isOverdue ? '#ef4444' : '#64748b'}">
        ${isOverdue ? `Vencida el ${dueDate}` : `${priorityEmoji[priority] ?? '🟡'} ${priority}`}
      </td>
    </tr>`
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border-radius:16px;padding:32px;margin-bottom:24px;">
    <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 4px">Buenos días, ${userName} 👋</h1>
    <p style="color:#94a3b8;margin:0;font-size:14px">${today}</p>
  </div>

  ${overdue.length > 0 ? `
  <div style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;padding:4px;margin-bottom:20px">
    <div style="padding:16px 16px 8px">
      <p style="margin:0;font-weight:700;color:#991b1b;font-size:14px">⚠️ ${overdue.length} tarea(s) vencida(s)</p>
    </div>
    <table style="width:100%;border-collapse:collapse">${overdue.map(t => row(t, true)).join('')}</table>
  </div>` : ''}

  ${tasks.length > 0 ? `
  <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:4px;margin-bottom:20px">
    <div style="padding:16px 16px 8px">
      <p style="margin:0;font-weight:700;color:#1e293b;font-size:14px">📋 ${tasks.length} tarea(s) para hoy</p>
    </div>
    <table style="width:100%;border-collapse:collapse">${tasks.map(t => row(t, false)).join('')}</table>
  </div>` : `
  <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
    <p style="font-size:32px;margin:0">🎉</p>
    <p style="font-weight:700;color:#1e293b">¡Sin tareas pendientes para hoy!</p>
  </div>`}

  <div style="text-align:center;margin-bottom:24px">
    <a href="${appUrl}/tareas" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:14px">
      Ver mis tareas en el CRM →
    </a>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin:0">CRM Automatizaciones · Notificación automática diaria</p>
</div></body></html>`
}
