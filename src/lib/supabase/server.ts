import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPermissions, normalizeRole, type Role } from '@/lib/roles'

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
    .select('id, full_name, email, role, is_active')
    .eq('id', user.id)
    .single()

  // Normalizar rol legacy (admin → super_admin, etc.)
  const role = normalizeRole(profile?.role ?? 'soporte')

  return { user, profile, role, supabase }
}

// Guard de permiso — redirige si el rol no tiene acceso
export async function requirePermission(
  permission: keyof ReturnType<typeof getPermissions>
) {
  const { profile, role, supabase, user } = await getCurrentProfile()

  const perms = getPermissions(role)
  const val = perms[permission]
  const hasAccess = typeof val === 'boolean' ? val : val !== 'none'

  if (!hasAccess) {
    redirect(`/acceso-denegado?from=protected&role=${role}`)
  }

  return { role, perms, profile, supabase, user }
}
