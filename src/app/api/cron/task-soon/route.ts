import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCronAuthorized } from '@/lib/secure-compare'
import { renderTaskSoon } from '@/lib/task-emails'
import type { EmailBrand } from '@/lib/email-layout'

// Cron cada minuto (pg_cron, migración 053): avisa por correo al
// responsable de cada tarea con hora unos minutos antes de que venza.
// El resumen de la mañana sigue en /api/cron/daily-tasks.

const MINUTES_BEFORE = 5

type Reminder = {
  task_id: string; title: string; description: string | null; due_date: string; deal_id: string | null
  user_id: string; email: string; full_name: string | null; organization_id: string | null; company_name: string | null
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
  if (reminders.length === 0) return NextResponse.json({ ok: true, sent: 0, failed: 0 })

  // Logo y datos de cada organización para el correo.
  const orgIds = [...new Set(reminders.map(r => r.organization_id).filter(Boolean))] as string[]
  const { data: orgs } = await supabase.from('organizations').select('id, name, display_name, logo_url, email, phone, address').in('id', orgIds)
  const brands = new Map<string, EmailBrand>((orgs ?? []).map(o => [o.id, { name: o.display_name || o.name, logoUrl: o.logo_url, email: o.email, phone: o.phone, address: o.address }]))

  let sent = 0
  const failed: string[] = []
  for (const r of reminders) {
    const brand = (r.organization_id && brands.get(r.organization_id)) || { name: 'CRM' }
    const { subject, html } = renderTaskSoon({
      firstName: (r.full_name ?? '').split(' ')[0], minutes: MINUTES_BEFORE,
      task: { title: r.title, due_date: r.due_date, company: r.company_name },
      description: r.description, link: `${appUrl}/tareas?tarea=${r.task_id}`, brand,
    })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || `${brand.name} <onboarding@resend.dev>`,
        to: [r.email], subject, html,
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
