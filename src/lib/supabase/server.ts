import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPermissions, normalizeRole, canEditSection, type SectionAccess } from '@/lib/roles'
import { getDisabledModules } from '@/lib/modules'
import { normalizeCurrency, normalizeTaxes, DEFAULT_TAXES, type Currency, type Tax } from '@/lib/money'

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

// Helper: obtiene perfil con el rol YA normalizado
export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, section_access, organization_id')
    .eq('id', user.id)
    .single()

  // Normalizar rol legacy (admin → super_admin, etc.)
  const role = normalizeRole(profile?.role ?? 'soporte')
  const sectionAccess = (profile?.section_access ?? null) as SectionAccess
  const organizationId: string | null = profile?.organization_id ?? null

  // Moneda base e impuestos por defecto de la organización (para mostrar montos).
  let currency: Currency = 'CLP'
  let taxes: Tax[] = DEFAULT_TAXES
  if (organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('is_active, currency, taxes')
      .eq('id', organizationId)
      .maybeSingle()
    if (org && org.is_active === false) {
      await supabase.auth.signOut()
      redirect('/organizacion-suspendida')
    }
    currency = normalizeCurrency(org?.currency)
    if (org?.taxes) taxes = normalizeTaxes(org.taxes)
  }

  return { user, profile, role, sectionAccess, organizationId, supabase, currency, taxes }
}

// Guard de permiso — redirige si el rol no tiene acceso.
// `permission` también se usa como key de NAV_SECTIONS para calcular canEdit (modo lectura/completo).
export async function requirePermission(
  permission: keyof ReturnType<typeof getPermissions>
) {
  const { profile, role, sectionAccess, organizationId, supabase, user, currency, taxes } = await getCurrentProfile()

  // Techo de organización: si el módulo está apagado para esta org, nadie
  // pasa, sin importar el rol. organizationId explícito: un platform_owner
  // vería (y le aplicarían) los módulos de TODAS las organizaciones sin
  // este filtro, porque su policy de SELECT bypasea el filtro de org.
  const disabledModules = await getDisabledModules(supabase, organizationId ?? undefined)
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
