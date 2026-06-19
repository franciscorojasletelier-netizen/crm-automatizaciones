import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { normalizeRole, NAV_SECTIONS } from '@/lib/roles'

const VALID_SECTIONS = new Set(NAV_SECTIONS.map(s => s.key))

export async function POST(request: NextRequest) {
  // 1. Autenticación y permiso del solicitante (solo jefaturas)
  let role: string
  try {
    ({ role } = await getCurrentProfile())
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const editorRole = normalizeRole(role)
  if (!['super_admin', 'gerente'].includes(editorRole)) {
    return NextResponse.json({ error: 'Sin permiso para crear usuarios' }, { status: 403 })
  }

  // 2. Datos de entrada
  const body = await request.json()
  const fullName = (body.fullName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const managerId = body.managerId || null
  const jobTitle = (body.jobTitle ?? '').trim() || null
  const areaId = body.areaId || null
  const isAdmin = !!body.isAdmin
  const sectionAccess: string[] = Array.isArray(body.sectionAccess)
    ? body.sectionAccess.filter((s: string) => VALID_SECTIONS.has(s))
    : []

  if (!fullName) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }
  // Un gerente no puede crear administradores
  if (isAdmin && editorRole !== 'super_admin') {
    return NextResponse.json({ error: 'Solo un Super Admin puede crear administradores' }, { status: 403 })
  }

  // El nivel base (para seguridad de datos / RLS) se deriva del interruptor Administrador
  const derivedRole = isAdmin ? 'gerente' : 'comercial'

  // 3. Cliente con service role (servidor)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 4. Crear el usuario en Auth (email confirmado para que pueda iniciar sesión)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr || !created?.user) {
    const msg = authErr?.message ?? 'No se pudo crear el usuario'
    const friendly = /already.*registered|exists/i.test(msg)
      ? 'Ya existe un usuario con ese email'
      : msg
    return NextResponse.json({ error: friendly }, { status: 400 })
  }

  const newUserId = created.user.id

  // 5. Crear el perfil
  const { error: profErr } = await admin.from('profiles').insert({
    id: newUserId,
    full_name: fullName,
    email,
    role: derivedRole,
    manager_id: managerId,
    job_title: jobTitle,
    area_id: areaId,
    section_access: sectionAccess,
    is_active: true,
  })

  if (profErr) {
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: `Error creando el perfil: ${profErr.message}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true, userId: newUserId })
}
