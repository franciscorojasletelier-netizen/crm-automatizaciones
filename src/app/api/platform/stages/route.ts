import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

async function requirePlatformOwner() {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { supabase }
}

// Crear una etapa nueva.
export async function POST(request: NextRequest) {
  const gate = await requirePlatformOwner()
  if (gate.error) return gate.error
  const { supabase } = gate

  const body = await request.json()
  const { organizationId, key, label, color, sortOrder } = body
  if (!organizationId || !key || !label) {
    return NextResponse.json({ error: 'organizationId, key y label son requeridos' }, { status: 400 })
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: 'La clave debe ser minúsculas, números y guión bajo, empezando con letra' }, { status: 400 })
  }

  const { data, error } = await supabase.from('pipeline_stages').insert({
    organization_id: organizationId, key, label,
    color: color ?? 'slate', sort_order: sortOrder ?? 0,
  }).select('id').single()

  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}

// Editar label/color/orden/banderas, activar/desactivar, o las acciones
// especiales de default/won (que van por función porque tocan toda la org).
export async function PATCH(request: NextRequest) {
  const gate = await requirePlatformOwner()
  if (gate.error) return gate.error
  const { supabase } = gate

  const body = await request.json()
  const { stageId, organizationId, action, ...fields } = body
  if (!stageId) return NextResponse.json({ error: 'stageId es requerido' }, { status: 400 })

  if (action === 'set_default') {
    if (!organizationId) return NextResponse.json({ error: 'organizationId es requerido' }, { status: 400 })
    const { error } = await supabase.rpc('set_default_stage', { p_org_id: organizationId, p_stage_id: stageId })
    if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_won') {
    if (!organizationId) return NextResponse.json({ error: 'organizationId es requerido' }, { status: 400 })
    const { error } = await supabase.rpc('set_won_stage', { p_org_id: organizationId, p_stage_id: stageId })
    if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Nunca se permite editar `key` desde acá — el trigger lo rechaza igual,
  // pero se filtra antes para dar un error claro en vez de uno de Postgres.
  delete fields.key

  const { error } = await supabase.from('pipeline_stages').update(fields).eq('id', stageId)
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
