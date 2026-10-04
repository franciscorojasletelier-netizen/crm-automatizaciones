import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chileDayStart } from '@/lib/dates'
import { renderDailyDigest } from '@/lib/task-emails'
import { isCronAuthorized } from '@/lib/secure-compare'

// Cron: 8:00 AM Chile (UTC-3) = 11:00 UTC
// vercel.json: "schedule": "0 11 * * *"

export async function GET(request: NextRequest) {
  // Falla cerrado: si CRON_SECRET no está seteada, el endpoint queda
  // público en vez de protegido — antes el chequeo se saltaba entero.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Solo claves de servidor: las funciones *_for_cron no se pueden ejecutar
  // con la clave publicable (migración 037).
  const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey   = process.env.RESEND_API_KEY
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-automatizaciones.vercel.app'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const now         = new Date()
    // Días calendario de Chile, no de UTC (el servidor corre en UTC)
    const todayStart  = chileDayStart(0, now).toISOString()
    const tomorrowEnd = chileDayStart(2, now).toISOString()

    // Perfiles via función SECURITY DEFINER (bypass RLS)
    const { data: profileRows, error: profErr } = await supabase
      .rpc('get_all_profiles_for_cron')
    if (profErr || !profileRows) {
      return NextResponse.json({ error: 'Could not fetch profiles', detail: profErr?.message }, { status: 500 })
    }

    const profiles = profileRows as { id: string; full_name: string; email: string; is_active: boolean; role?: string }[]

    // La marca en el email tiene que ser la de la organización del
    // destinatario, no una fija — antes todos los emails de este cron decían
    // "CRM Autopilot" sin importar a qué organización pertenecía el usuario.
    const { data: orgLinks } = await supabase
      .from('profiles').select('id, organization_id').in('id', profiles.map(p => p.id))
    const orgIdByProfile = new Map(((orgLinks ?? []) as { id: string; organization_id: string | null }[]).map(p => [p.id, p.organization_id] as const))
    const orgIds = Array.from(new Set(Array.from(orgIdByProfile.values()).filter(Boolean)))
    const { data: orgs } = orgIds.length > 0
      ? await supabase.from('organizations').select('id, name, display_name, logo_url, email, phone, address').in('id', orgIds)
      : { data: [] }
    type OrgRow = { id: string; name: string; display_name: string | null; logo_url: string | null; email: string | null; phone: string | null; address: string | null }
    const brandById = new Map(((orgs ?? []) as OrgRow[]).map(o => [o.id, { name: o.display_name || o.name || 'CRM', logoUrl: o.logo_url, email: o.email, phone: o.phone, address: o.address }] as const))

    let sent = 0
    const errors: string[] = []

    for (const profile of profiles) {
      const orgId = orgIdByProfile.get(profile.id)
      const brand = (orgId && brandById.get(orgId)) || { name: 'CRM' }
      // Usuarios desactivados no reciben el resumen.
      if (!profile.email || profile.is_active === false) continue

      // Tareas para hoy/mañana via función SECURITY DEFINER
      const { data: tasks } = await supabase
        .rpc('get_tasks_for_cron', {
          p_user_id: profile.id,
          p_from:    todayStart,
          p_to:      tomorrowEnd,
        })

      // Tareas vencidas via función SECURITY DEFINER
      const { data: overdue } = await supabase
        .rpc('get_overdue_tasks_for_cron', {
          p_user_id: profile.id,
          p_before:  todayStart,
        })

      const taskList    = tasks   ?? []
      const overdueList = overdue ?? []

      if (taskList.length === 0 && overdueList.length === 0) continue

      const userName = (profile.full_name ?? '').split(' ')[0] || 'equipo'
      const { subject, html } = renderDailyDigest({
        userName, appUrl, brand,
        overdue: overdueList.map((t: { title: string; due_date: string | null }) => ({ title: t.title, due_date: t.due_date })),
        upcoming: taskList.map((t: { title: string; due_date: string | null }) => ({ title: t.title, due_date: t.due_date })),
      })

      if (!resendKey) {
        console.log(`[CRON] Would email ${profile.email}: ${subject}`)
        sent++
        continue
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    process.env.EMAIL_FROM?.trim() || `${brand.name} <onboarding@resend.dev>`,
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

// pg_cron llama vía POST (net.http_post) — mismo handler que GET, que
// se mantiene para poder disparar el cron a mano desde el navegador.
export const POST = GET

// ── Template HTML ────────────────────────────────────────────────
