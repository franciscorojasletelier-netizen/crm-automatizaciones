import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

// Prender/apagar un módulo para una organización, o fijarle fecha de
// vencimiento (módulo contratado por un plazo). Upsert: si no existía
// fila (fail-open = habilitado), la crea; si existía, la actualiza.
export async function PATCH(request: NextRequest) {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json()
  const { organizationId, moduleKey, enabled, expiresOn } = body
  if (!organizationId || !moduleKey) {
    return NextResponse.json({ error: 'organizationId y moduleKey son requeridos' }, { status: 400 })
  }

  const row: Record<string, unknown> = { organization_id: organizationId, module_key: moduleKey }
  if (typeof enabled === 'boolean') row.enabled = enabled
  if ('expiresOn' in body) {
    if (expiresOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(expiresOn))) {
      return NextResponse.json({ error: 'Fecha de vencimiento inválida' }, { status: 400 })
    }
    // Vence al final del día en Chile.
    row.expires_at = expiresOn ? `${expiresOn}T23:59:59-03:00` : null
  }
  if (Object.keys(row).length === 2) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const { error } = await supabase.from('organization_modules')
    .upsert(row, { onConflict: 'organization_id,module_key' })

  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
