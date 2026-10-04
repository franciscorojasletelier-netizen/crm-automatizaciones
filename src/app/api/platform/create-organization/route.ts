import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import crypto from 'node:crypto'
import { applyPlan, isPlanKey, PLANS, type PlanKey } from '@/lib/plans'
import { renderInvitation } from '@/lib/system-emails'
import { sendSystemMail, systemMailConfigured } from '@/lib/email/system-mail'

// Crea una organización (cliente) nueva + su primer usuario super_admin.
// Solo accesible para quienes están en la tabla platform_owners —
// NO alcanza con ser super_admin de una organización existente.
export async function POST(request: NextRequest) {
  let userId: string, supabase
  try {
    const ctx = await getCurrentProfile()
    userId = ctx.user.id
    supabase = ctx.supabase
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: owner } = await supabase
    .from('platform_owners')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!owner) {
    return NextResponse.json({ error: 'Sin permiso para crear organizaciones' }, { status: 403 })
  }

  const body = await request.json()
  const orgName = (body.orgName ?? '').trim()
  const fullName = (body.fullName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const plan: PlanKey = isPlanKey(body.plan) ? body.plan : 'profesional'
  // Invitación: el admin define su propia contraseña desde un enlace por
  // correo. Sin correo del sistema se exige contraseña temporal.
  const invite = body.invite === true
  if (invite && !systemMailConfigured()) {
    return NextResponse.json({ error: 'Para invitar por correo hay que activar el correo del sistema (Resend). Usa una contraseña temporal.' }, { status: 400 })
  }
  const password = invite ? crypto.randomBytes(24).toString('base64url') : (body.password ?? '')

  if (!orgName) return NextResponse.json({ error: 'El nombre de la organización es requerido' }, { status: 400 })
  if (!fullName) return NextResponse.json({ error: 'El nombre del admin es requerido' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Crear la organización
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name: orgName })
    .select('id')
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message ?? 'No se pudo crear la organización' }, { status: 400 })
  }

  // 1b. Sembrar embudo y módulos por defecto. Sin esto la organización
  // queda inutilizable: no se puede crear ningún deal, porque el trigger
  // set_default_stage_on_deal no encuentra etapa por defecto.
  const { error: stagesErr } = await admin.rpc('seed_default_stages', { p_org_id: org.id })
  const { error: modulesErr } = await admin.rpc('seed_default_modules', { p_org_id: org.id })

  if (stagesErr || modulesErr) {
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json(
      { error: `No se pudo configurar la organización: ${stagesErr?.message ?? modulesErr?.message}` },
      { status: 400 }
    )
  }

  // 2. Crear el usuario en Auth
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr || !created?.user) {
    // Rollback de la organización si falla el usuario
    await admin.from('organizations').delete().eq('id', org.id)
    const msg = authErr?.message ?? 'No se pudo crear el usuario'
    const friendly = /already.*registered|exists/i.test(msg) ? 'Ya existe un usuario con ese email' : msg
    return NextResponse.json({ error: friendly }, { status: 400 })
  }

  // 3. Crear su perfil como super_admin de la organización nueva
  const { error: profErr } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role: 'super_admin',
    is_active: true,
    organization_id: org.id,
  })

  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: `Error creando el perfil: ${profErr.message}` }, { status: 400 })
  }

  // 4. Plan: límite de usuarios y módulos. Un fallo acá no deshace el alta
  // (se corrige desde la ficha de la organización).
  const planErr = await applyPlan(admin, org.id, plan)

  // 5. Invitación por correo con enlace para definir la contraseña.
  let invited = false
  if (invite) {
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery', email,
      options: { redirectTo: `${request.nextUrl.origin}/restablecer-password` },
    })
    if (link?.properties?.action_link) {
      const first = fullName.split(/\s+/)[0]
      const invitation = renderInvitation({
        name: fullName, orgName, planLabel: PLANS[plan].label, email,
        link: link.properties.action_link, loginUrl: `${request.nextUrl.origin}/login`,
        brand: { name: orgName },
      })
      const sent = await sendSystemMail({
        to: email,
        subject: invitation.subject,
        html: invitation.html,
        fromName: 'CRM Automatizaciones',
        body: [
          `Hola ${first}:`,
          '',
          `Ya está lista la cuenta de ${orgName} en el CRM (plan ${PLANS[plan].label}). Eres su administrador.`,
          '',
          'Para entrar, define tu contraseña con este enlace (vence en 1 hora; si expira, usa "¿La olvidaste?" en la pantalla de ingreso):',
          link.properties.action_link,
          '',
          `Después ingresa en ${request.nextUrl.origin}/login con ${email}.`,
          '',
          'Si no esperabas este correo, puedes ignorarlo.',
        ].join('\n'),
      })
      invited = sent.ok
    }
  }

  return NextResponse.json({ ok: true, organizationId: org.id, userId: created.user.id, invited, planWarning: planErr ?? undefined })
}

