import type { SupabaseClient } from '@supabase/supabase-js'

// Roles que reciben los avisos de jefatura (deal perdido, ganado, fallas
// de automatización). 'admin' es el nombre legacy de super_admin.
export const MANAGER_ROLES = ['gerente', 'super_admin', 'admin'] as const

export type NotificationInput = {
  type: string
  title: string
  body: string
  entity_type?: string
  entity_id?: string
}

// IDs de los gerentes activos. Con un cliente de sesión, RLS ya lo acota a
// la organización del usuario; con service_role hay que pasar organizationId.
export async function getActiveManagerIds(supabase: SupabaseClient, organizationId?: string): Promise<string[]> {
  let query = supabase.from('profiles').select('id').in('role', [...MANAGER_ROLES]).eq('is_active', true)
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data } = await query
  return (data ?? []).map(p => p.id as string)
}

// Una notificación por gerente, en un solo insert. `exclude` evita avisarle
// a alguien de algo que acaba de hacer él mismo.
export async function notifyManagers(
  supabase: SupabaseClient,
  notification: NotificationInput,
  { exclude = [], organizationId }: { exclude?: (string | null | undefined)[]; organizationId?: string } = {}
) {
  const skip = new Set(exclude.filter(Boolean))
  const ids = (await getActiveManagerIds(supabase, organizationId)).filter(id => !skip.has(id))
  if (ids.length === 0) return
  await supabase.from('notifications').insert(ids.map(user_id => ({ user_id, ...notification })))
}
