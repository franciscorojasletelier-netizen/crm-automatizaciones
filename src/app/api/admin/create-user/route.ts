import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { normalizeRole, type Role } from '@/lib/roles'

// Roles que cada editor puede asignar al crear usuarios
const ASSIGNABLE: Record<string, Role[]> = {
  super_admin: ['gerente', 'comercial', 'produccion', 'soporte'],
  gerente:     ['comercial', 'produccion', 'soporte'],
}

export async function POST(request: NextRequest) {
  // 1. Autenticación y permiso del solicitante
  let role: string
  try {
    ({ role } = await getCurrentProfile())
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const editorRole = normalizeRole(role)
  const allowedRoles = ASSIGNABLE[editorRole]
  if (!allowedRoles) {
    return NextResponse.json({ error: 'Sin permiso para crear usuarios' }, { status: 403 })
  }

  // 2. Datos de entrada
  const body = await request.json()
  const fullName = (body.fullName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const newRole = body.role as Role
  const managerId = body.managerId || null

  if (!fullName) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }
  if (!allowedRoles.includes(newRole)) {
    return NextResponse.json({ error: `No puedes asignar el rol "${newRole}"` }, { status: 403 })
  }

  // 3. Cliente con service role (servidor)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 4. Crear el usuario en Auth (email ya confirmado para que pueda iniciar sesión)
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

  // 5. Crear el perfil (no hay trigger automático en esta BD)
  const { error: profErr } = await admin.from('profiles').insert({
    id: newUserId,
    full_name: fullName,
    email,
    role: newRole,
    manager_id: managerId,
    is_active: true,
  })

  if (profErr) {
    // Rollback: si falla el perfil, eliminar el usuario de Auth para no dejar huérfanos
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: `Error creando el perfil: ${profErr.message}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true, userId: newUserId })
}
