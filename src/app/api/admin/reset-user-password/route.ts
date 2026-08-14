import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/roles'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { Resend } from 'resend'

// El admin/gerente nunca ve ni define la contraseña de otro usuario —
// solo dispara un enlace de recuperación real de Supabase Auth, igual
// al que el propio usuario pediría desde /olvide-password. Cierra el
// callejón sin salida de "contactá al administrador" cuando el
// administrador tampoco tenía ninguna función para esto.
export async function POST(request: NextRequest) {
  const requestClient = await createServerClient()
  const { data: { user } } = await requestClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: editorProfile } = await requestClient
    .from('profiles').select('role, organization_id').eq('id', user.id).single()

  const editorRole = normalizeRole(editorProfile?.role ?? '')
  const organizationId = (editorProfile as any)?.organization_id ?? null

  if (!['super_admin', 'gerente'].includes(editorRole)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  if (!organizationId) {
    return NextResponse.json({ error: 'Tu cuenta no tiene una organización asignada' }, { status: 403 })
  }

  const body = await request.json()
  const userId = body.userId as string
  if (!userId) return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Frena tanto al que dispara el reset (por si su sesión se compromete)
  // como al blanco (para no bombardearlo de emails si alguien machaca el botón).
  const ip = getClientIp(request)
  const [byActor, byIp] = await Promise.all([
    checkRateLimit(admin, 'admin_reset_password', user.id, { maxHits: 10, windowMinutes: 15 }),
    checkRateLimit(admin, 'admin_reset_password_ip', ip, { maxHits: 20, windowMinutes: 15 }),
  ])
  if (!byActor.allowed || !byIp.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  }

  // El objetivo tiene que pertenecer a la MISMA organización que quien
  // pide el reset — sin esto, cualquier gerente podría resetear la
  // contraseña de un usuario de otra empresa cliente conociendo su id.
  const { data: target } = await admin
    .from('profiles').select('id, email, full_name, organization_id')
    .eq('id', userId).maybeSingle()

  if (!target || target.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Usuario no encontrado en tu organización' }, { status: 404 })
  }
  if (!target.email) {
    return NextResponse.json({ error: 'Ese usuario no tiene email registrado' }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: target.email,
    options: { redirectTo: `${origin}/restablecer-password` },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'No se pudo generar el enlace' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (resendKey) {
    const { data: org } = await admin.from('organizations').select('name, display_name').eq('id', organizationId).maybeSingle()
    const orgName = org?.display_name || org?.name || 'tu organización'
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: process.env.EMAIL_FROM?.trim() || `${orgName} <onboarding@resend.dev>`,
      to: target.email,
      subject: 'Restablecé tu contraseña',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#111">Hola${target.full_name ? ` ${target.full_name.split(' ')[0]}` : ''}</h2>
          <p style="color:#444;line-height:1.6">Un administrador de ${orgName} generó un enlace para que restablezcas tu contraseña de acceso al CRM.</p>
          <a href="${linkData.properties.action_link}"
             style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Restablecer contraseña
          </a>
          <p style="color:#999;font-size:12px;">Si no lo esperabas, podés ignorar este correo.</p>
        </div>
      `,
    }).catch(e => console.warn('Error enviando email de reset:', e))
  }

  return NextResponse.json({ ok: true })
}
