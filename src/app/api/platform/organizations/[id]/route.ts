import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, any> = {}

  if (typeof body.isActive === 'boolean') {
    updates.is_active = body.isActive
  }

  if ('maxUsers' in body) {
    if (body.maxUsers !== null && (!Number.isInteger(body.maxUsers) || body.maxUsers < 1)) {
      return NextResponse.json({ error: 'maxUsers debe ser un entero positivo, o null para sin límite' }, { status: 400 })
    }
    updates.max_users = body.maxUsers
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
