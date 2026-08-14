import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

// Prender/apagar un módulo para una organización. Upsert: si no existía
// fila (fail-open = habilitado), la crea; si existía, la actualiza.
export async function PATCH(request: NextRequest) {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json()
  const { organizationId, moduleKey, enabled } = body
  if (!organizationId || !moduleKey || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'organizationId, moduleKey y enabled son requeridos' }, { status: 400 })
  }

  const { error } = await supabase.from('organization_modules')
    .upsert({ organization_id: organizationId, module_key: moduleKey, enabled }, { onConflict: 'organization_id,module_key' })

  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
