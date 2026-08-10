import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'

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
  const password = body.password ?? ''

  if (!orgName) return NextResponse.json({ error: 'El nombre de la organización es requerido' }, { status: 400 })
  if (!fullName) return NextResponse.json({ error: 'El nombre del admin es requerido' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
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

  return NextResponse.json({ ok: true, organizationId: org.id, userId: created.user.id })
}
