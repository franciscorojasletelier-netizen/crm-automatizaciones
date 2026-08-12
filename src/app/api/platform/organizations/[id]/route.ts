import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'

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
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive es requerido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('organizations')
    .update({ is_active: body.isActive })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
