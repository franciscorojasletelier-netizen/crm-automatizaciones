import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { chileDayStart } from '@/lib/dates'
import { renderOrgDigest, type TaskLine } from '@/lib/task-emails'
import { isCronAuthorized } from '@/lib/secure-compare'

export async function GET(request: NextRequest) {
  // Falla cerrado: si CRON_SECRET no está seteada, el endpoint queda
  // público en vez de protegido — mismo guard que los otros 3 crons
  // (antes este era el único que no lo tenía).
  if (!isCronAuthorized(request)) {
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
    .select('id, name, display_name, notification_email, logo_url, email, phone, address')
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

    const brand = { name: org.display_name || org.name, logoUrl: org.logo_url, email: org.email, phone: org.phone, address: org.address }
    // deals(companies(name)) es a-uno; sin tipos de base se infiere como arreglo.
    const toLines = (rows: unknown[] | null): TaskLine[] => ((rows ?? []) as { title: string; due_date: string; deals: { companies: { name: string | null } | null } | null }[])
      .map(t => ({ title: t.title, due_date: t.due_date, company: t.deals?.companies?.name ?? null }))
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://crm-automatizaciones.vercel.app'
    const { subject, html } = renderOrgDigest({ today: toLines(todayTasks), overdue: toLines(overdueTasks), appUrl, brand })
    await resend.emails.send({
      from: process.env.EMAIL_FROM?.trim() || 'CRM Automatizaciones <onboarding@resend.dev>',
      to: org.notification_email!,
      subject, html,
    })
    sent++
  }

  return NextResponse.json({ status: 'ok', organizationsNotified: sent, organizationsChecked: orgs?.length ?? 0 })
}

// pg_cron llama vía POST (net.http_post) — mismo handler que GET, que
// se mantiene para poder disparar el cron a mano desde el navegador.
export const POST = GET
