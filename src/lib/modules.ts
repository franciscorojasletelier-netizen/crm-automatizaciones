// ============================================================
//  Módulos habilitados por organización — el techo de todos los
//  permisos (por encima de rol y de section_access).
//
//  Lectura FAIL-OPEN por diseño: la ausencia de una fila en
//  organization_modules significa "habilitado". Solo una fila
//  explícita con enabled=false apaga un módulo. Así, agregar una
//  sección nueva al CRM no la deja invisible para las organizaciones
//  existentes hasta sembrarla a mano.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Claves de módulo que esta organización tiene explícitamente apagadas.
 *
 * orgId es obligatorio pasarlo cuando quien consulta puede ser
 * platform_owner: su policy de SELECT es
 * "organization_id = current_org_id() OR is_platform_owner()", así que sin
 * filtro explícito vería (y mezclaría) los módulos apagados de TODAS las
 * organizaciones, no solo la propia.
 */
export async function getDisabledModules(supabase: SupabaseClient, orgId?: string): Promise<Set<string>> {
  // Apagado explícito o con fecha de vencimiento ya cumplida (módulo contratado por un plazo).
  let q = supabase.from('organization_modules').select('module_key')
    .or(`enabled.eq.false,expires_at.lt.${new Date().toISOString()}`)
  if (orgId) q = q.eq('organization_id', orgId)
  const { data } = await q
  return new Set(((data ?? []) as { module_key: string }[]).map(r => r.module_key))
}

export function isModuleEnabled(disabledModules: Set<string> | null | undefined, key: string): boolean {
  return !disabledModules?.has(key)
}
