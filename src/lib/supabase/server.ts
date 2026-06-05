import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPermissions, type Role } from '@/lib/roles'

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

// Helper para obtener perfil del usuario actual con manejo de errores
export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', user.id)
    .single()

  return { user, profile, supabase }
}

// Guard de permiso — redirige si no tiene acceso
export async function requirePermission(
  permission: keyof ReturnType<typeof getPermissions>
) {
  const { profile } = await getCurrentProfile()
  const role = (profile?.role ?? 'soporte') as Role
  const perms = getPermissions(role)
  const val = perms[permission]

  const hasAccess = typeof val === 'boolean' ? val : val !== 'none'
  if (!hasAccess) {
    redirect(`/acceso-denegado?from=protected&role=${role}`)
  }

  return { role, perms, profile }
}
