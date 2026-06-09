/**
 * API temporal — cambiar rol de un usuario por nombre
 * Requiere estar autenticado como super_admin
 * Usar: GET /api/admin/fix-role?name=Carlos+Mendoza&role=gerente
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['super_admin', 'admin', 'gerente'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const name = req.nextUrl.searchParams.get('name')
  const role = req.nextUrl.searchParams.get('role')
  if (!name || !role) return NextResponse.json({ error: 'Falta name o role' }, { status: 400 })

  const { data: target } = await supabase
    .from('profiles').select('id, full_name, role')
    .ilike('full_name', `%${name}%`).single()

  if (!target) return NextResponse.json({ error: `Usuario "${name}" no encontrado` }, { status: 404 })

  const { error } = await supabase.from('profiles').update({ role }).eq('id', target.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    message: `✅ ${target.full_name}: ${target.role} → ${role}`,
  })
}
