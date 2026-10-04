import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getPermissions, normalizeRole, canEditSection, type SectionAccess } from '@/lib/roles'
import { normalizeCurrency, normalizeTaxes, DEFAULT_TAXES, type Currency, type Tax } from '@/lib/money'
import { normalizePaymentTerms, DEFAULT_PAYMENT_TERMS, DEFAULT_PAYMENT_CONDITIONS, type PaymentTerm } from '@/lib/payment-terms'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

type ModuleRow = { module_key: string; enabled: boolean; expires_at: string | null }
type OrgRow = { name: string | null; display_name: string | null; is_active: boolean | null; currency: string | null; taxes: unknown; payment_terms: unknown; payment_conditions: string | null; organization_modules: ModuleRow[] | null }

// Helper: obtiene perfil con el rol YA normalizado.
//
// Rendimiento (corre en cada página): cache() lo comparte entre el layout y
// la página de una misma petición; getClaims() valida el JWT de la sesión
// sin ir a Supabase Auth (con claves asimétricas; si no, cae a getUser), y
// perfil + organización + módulos salen en una sola consulta.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) redirect('/login')
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, section_access, organization_id, organizations(name, display_name, is_active, currency, taxes, payment_terms, payment_conditions, organization_modules(module_key, enabled, expires_at))')
    .eq('id', user.id)
    .single()

  // Normalizar rol legacy (admin → super_admin, etc.)
  const role = normalizeRole(profile?.role ?? 'soporte')
  const sectionAccess = (profile?.section_access ?? null) as SectionAccess
  const organizationId: string | null = profile?.organization_id ?? null
  // organizations es a-uno; sin tipos de base se infiere como arreglo.
  const org = (profile?.organizations ?? null) as unknown as OrgRow | null

  if (organizationId && org && org.is_active === false) {
    await supabase.auth.signOut()
    redirect('/organizacion-suspendida')
  }
  // Moneda base e impuestos por defecto de la organización (para mostrar montos).
  const currency: Currency = normalizeCurrency(org?.currency)
  const taxes: Tax[] = org?.taxes ? normalizeTaxes(org.taxes) : DEFAULT_TAXES
  // Módulos apagados o vencidos de SU organización (mismo criterio que getDisabledModules).
  const now = Date.now()
  const disabledModules = new Set((org?.organization_modules ?? [])
    .filter(m => !m.enabled || (m.expires_at && Date.parse(m.expires_at) < now))
    .map(m => m.module_key))

  const organizationName = org ? (org.display_name || org.name) : null
  // Plan de pagos y condiciones por defecto de las cotizaciones.
  const paymentTerms: PaymentTerm[] = normalizePaymentTerms(org?.payment_terms) ?? DEFAULT_PAYMENT_TERMS
  const paymentConditions: string = org?.payment_conditions ?? DEFAULT_PAYMENT_CONDITIONS

  return { user, profile, role, sectionAccess, organizationId, organizationName, supabase, currency, taxes, disabledModules, paymentTerms, paymentConditions }
})

// Guard de permiso — redirige si el rol no tiene acceso.
// `permission` también se usa como key de NAV_SECTIONS para calcular canEdit (modo lectura/completo).
export async function requirePermission(
  permission: keyof ReturnType<typeof getPermissions>
) {
  // Techo de organización: si el módulo está apagado para esta org, nadie
  // pasa, sin importar el rol (los módulos vienen de SU organización).
  const { profile, role, sectionAccess, organizationId, supabase, user, currency, taxes, disabledModules } = await getCurrentProfile()
  if (disabledModules.has(permission as string)) {
    redirect(`/acceso-denegado?from=protected&role=${role}`)
  }

  const perms = getPermissions(role)
  const val = perms[permission]
  const hasAccess = typeof val === 'boolean' ? val : val !== 'none'

  if (!hasAccess) {
    redirect(`/acceso-denegado?from=protected&role=${role}`)
  }

  const canEdit = canEditSection(role, sectionAccess, permission as string, disabledModules)

  return { role, perms, profile, sectionAccess, organizationId, canEdit, supabase, user, disabledModules, currency, taxes }
}
