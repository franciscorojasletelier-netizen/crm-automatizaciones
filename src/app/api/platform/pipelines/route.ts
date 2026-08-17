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

// Crea un pipeline nuevo con dos etapas mínimas (nuevo/ganado) vía la
// función create_pipeline — así nunca queda un pipeline sin etapa por
// defecto, que rompería la creación de deals ahí.
export async function POST(request: NextRequest) {
  const gate = await requirePlatformOwner()
  if (gate.error) return gate.error
  const { supabase } = gate

  const body = await request.json()
  const { organizationId, name } = body
  if (!organizationId || !name?.trim()) {
    return NextResponse.json({ error: 'organizationId y name son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('create_pipeline', { p_org_id: organizationId, p_name: name.trim() })
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true, id: data })
}
