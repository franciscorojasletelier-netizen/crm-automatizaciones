// ─────────────────────────────────────────────
//  HELPERS DE VISIBILIDAD
//  Decide qué registros puede ver cada rol
// ─────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

type CanSeeAll  = 'super_admin' | 'gerente'
type OwnerOnly  = 'comercial'
type MemberOnly = 'produccion' | 'soporte'

/**
 * Devuelve los IDs de deals que el usuario puede ver.
 * - super_admin / gerente   → null  (sin filtro — ve todo)
 * - comercial               → propios + compartidos (deal_members)
 */
export async function getVisibleDealIds(
  supabase: SupabaseClient,
  userId: string,
  role: string
): Promise<string[] | null> {
  if (['super_admin', 'gerente'].includes(role)) return null // sin filtro

  // Deals propios
  const ownedIds: string[] = []
  const { data: owned } = await supabase
    .from('deals')
    .select('id')
    .eq('owner_id', userId)
  owned?.forEach(d => ownedIds.push(d.id))

  // Deals compartidos via deal_members
  const { data: members } = await supabase
    .from('deal_members')
    .select('deal_id')
    .eq('user_id', userId)
  members?.forEach(m => ownedIds.push(m.deal_id))

  // Deduplicar
  return [...new Set(ownedIds)]
}

/**
 * Devuelve los IDs de proyectos que el usuario puede ver.
 * - super_admin / gerente   → null (ve todo)
 * - produccion / soporte    → propios + compartidos (project_members)
 */
export async function getVisibleProjectIds(
  supabase: SupabaseClient,
  userId: string,
  role: string
): Promise<string[] | null> {
  if (['super_admin', 'gerente'].includes(role)) return null

  const ids: string[] = []

  const { data: owned } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
  owned?.forEach(p => ids.push(p.id))

  const { data: members } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
  members?.forEach(m => ids.push(m.project_id))

  return [...new Set(ids)]
}

/**
 * Verifica si un usuario puede ver un deal específico.
 * Retorna false si está bloqueado.
 */
export async function canSeeDeal(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  dealId: string
): Promise<boolean> {
  if (['super_admin', 'gerente'].includes(role)) return true

  if (role === 'comercial') {
    // Es owner?
    const { data: deal } = await supabase
      .from('deals').select('owner_id').eq('id', dealId).single()
    if (deal?.owner_id === userId) return true

    // Es miembro?
    const { data: member } = await supabase
      .from('deal_members')
      .select('id').eq('deal_id', dealId).eq('user_id', userId).single()
    return !!member
  }

  return false // produccion/soporte no ven deals
}

/**
 * Verifica si un usuario puede ver un proyecto específico.
 */
export async function canSeeProject(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  projectId: string
): Promise<boolean> {
  if (['super_admin', 'gerente'].includes(role)) return true

  if (['produccion', 'soporte'].includes(role)) {
    const { data: project } = await supabase
      .from('projects').select('owner_id').eq('id', projectId).single()
    if (project?.owner_id === userId) return true

    const { data: member } = await supabase
      .from('project_members')
      .select('id').eq('project_id', projectId).eq('user_id', userId).single()
    return !!member
  }

  return false
}
