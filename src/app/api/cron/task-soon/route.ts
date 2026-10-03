import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CHILE_TZ } from '@/lib/dates'
import { escapeHtml } from '@/lib/html'
import { isCronAuthorized } from '@/lib/secure-compare'

// Cron cada minuto (pg_cron, migración 053): avisa por correo al
// responsable de cada tarea con hora unos minutos antes de que venza.
// El resumen de la mañana sigue en /api/cron/daily-tasks.

const MINUTES_BEFORE = 5

type Reminder = {
  task_id: string; title: string; description: string | null; due_date: string; deal_id: string | null
  user_id: string; email: string; full_name: string | null; org_name: string | null; company_name: string | null
}

const timeOf = (d: string) => new Date(d).toLocaleTimeString('es-CL', { timeZone: CHILE_TZ, hour: '2-digit', minute: '2-digit' })

function buildHtml(r: Reminder, appUrl: string) {
  const first = (r.full_name ?? '').split(' ')[0]
  const link = `${appUrl}/tareas?tarea=${r.task_id}`
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f7;padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:24px 28px 8px;font:500 13px/1.4 ${font};color:#6b7280;">${escapeHtml(r.org_name ?? 'CRM')} · Recordatorio</td></tr>
      <tr><td style="padding:0 28px;font:600 20px/1.35 ${font};color:#111827;">${first ? `${escapeHtml(first)}, en` : 'En'} ${MINUTES_BEFORE} minutos tienes:</td></tr>
      <tr><td style="padding:16px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font:700 26px/1.2 ${font};color:#111827;">${timeOf(r.due_date)}</div>
            <div style="font:600 15px/1.4 ${font};color:#111827;margin-top:6px;">${escapeHtml(r.title)}</div>
            ${r.company_name ? `<div style="font:400 13px/1.4 ${font};color:#6b7280;margin-top:2px;">${escapeHtml(r.company_name)}</div>` : ''}
            ${r.description ? `<div style="font:400 13px/1.5 ${font};color:#374151;margin-top:10px;white-space:pre-wrap;">${escapeHtml(r.description.slice(0, 500))}</div>` : ''}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font:600 14px/1 ${font};padding:12px 18px;border-radius:8px;">Abrir la tarea</a>
      </td></tr>
    </table>
    <p style="font:400 11px/1.4 ${font};color:#9ca3af;margin:12px 0 0;">Aviso automático ${MINUTES_BEFORE} minutos antes de cada tarea con hora.</p>
  </td></tr></table></body></html>`
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (!resendKey) return NextResponse.json({ error: 'Falta RESEND_API_KEY' }, { status: 503 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://crm-automatizaciones.vercel.app'

  // Toma los avisos de forma atómica: dos ejecuciones cruzadas no duplican correos.
  const { data, error } = await supabase.rpc('claim_task_reminders', { p_minutes: MINUTES_BEFORE })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const reminders = (data ?? []) as Reminder[]

  let sent = 0
  const failed: string[] = []
  for (const r of reminders) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || `${r.org_name ?? 'CRM'} <onboarding@resend.dev>`,
        to: [r.email],
        subject: `⏰ ${timeOf(r.due_date)} · ${r.title}`,
        html: buildHtml(r, appUrl),
      }),
    })
    if (res.ok) { sent++; continue }
    // Se libera la marca para reintentar en la próxima ejecución (si aún no vence).
    failed.push(r.task_id)
    await supabase.rpc('release_task_reminder', { p_task_id: r.task_id })
  }

  return NextResponse.json({ ok: true, sent, failed: failed.length })
}

// pg_cron llama vía POST (net.http_post).
export const POST = GET
