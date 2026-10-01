// ============================================================
//  Planes comerciales (SaaS). Un plan fija el límite de usuarios y qué
//  módulos quedan encendidos; 'personalizado' no toca nada.
//  Los módulos de gestión (usuarios, configuración, actividad,
//  organigrama, notificaciones, dashboard) van en todos los planes.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

export type PlanKey = 'basico' | 'profesional' | 'empresa' | 'personalizado'

/** Todos los módulos que siembra seed_default_modules. */
export const ALL_MODULES = [
  'dashboard', 'pipeline', 'leads', 'empresas', 'tareas', 'proyectos', 'cobranza',
  'calendario', 'organigrama', 'notificaciones', 'reportes', 'automatizaciones',
  'actividad', 'usuarios', 'configuracion',
] as const

const CORE = ['dashboard', 'pipeline', 'leads', 'empresas', 'tareas', 'calendario', 'organigrama', 'notificaciones', 'actividad', 'usuarios', 'configuracion']

export const PLANS: Record<PlanKey, { label: string; description: string; maxUsers: number | null; modules: string[] | null }> = {
  basico: {
    label: 'Básico', maxUsers: 3, modules: CORE,
    description: 'Hasta 3 usuarios. Pipeline, leads, empresas, tareas y calendario.',
  },
  profesional: {
    label: 'Profesional', maxUsers: 10, modules: [...CORE, 'proyectos', 'cobranza', 'reportes'],
    description: 'Hasta 10 usuarios. Suma proyectos, cobranza y reportes.',
  },
  empresa: {
    label: 'Empresa', maxUsers: null, modules: [...ALL_MODULES],
    description: 'Usuarios ilimitados y todos los módulos, incluidas automatizaciones.',
  },
  personalizado: {
    label: 'Personalizado', maxUsers: null, modules: null,
    description: 'Límite y módulos configurados a mano.',
  },
}

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && v in PLANS
}

/**
 * Aplica un plan: guarda la etiqueta y, salvo 'personalizado', el límite
 * de usuarios y los módulos. db debe ser el dueño de la plataforma o
 * service_role (la base rechaza el cambio a cualquier otro).
 */
export async function applyPlan(db: SupabaseClient, organizationId: string, plan: PlanKey): Promise<string | null> {
  const def = PLANS[plan]
  const orgUpdate: Record<string, unknown> = { plan }
  if (plan !== 'personalizado') orgUpdate.max_users = def.maxUsers
  const { error: orgErr } = await db.from('organizations').update(orgUpdate).eq('id', organizationId)
  if (orgErr) return orgErr.message
  if (!def.modules) return null

  const enabled = new Set(def.modules)
  const { error: modErr } = await db.from('organization_modules').upsert(
    ALL_MODULES.map(key => ({ organization_id: organizationId, module_key: key, enabled: enabled.has(key) })),
    { onConflict: 'organization_id,module_key' },
  )
  return modErr?.message ?? null
}
