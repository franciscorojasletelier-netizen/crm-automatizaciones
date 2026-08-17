import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessRouteWithAccess } from '@/lib/roles'
import { getDisabledModules } from '@/lib/modules'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isAuthRoute   = pathname.startsWith('/login') || pathname.startsWith('/olvide-password')
  // /api/auth/login tiene que ser alcanzable SIN sesión — es el propio
  // endpoint de login. Sin esto, el middleware lo redirige a /login antes
  // de que el fetch del formulario reciba una respuesta JSON.
  const isPublicRoute = pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/whatsapp') || pathname === '/api/auth/login' || pathname.startsWith('/api/public')
  // /restablecer-password: el enlace de recuperación pone al usuario en una
  // sesión temporal — no puede tratarse ni como "sin sesión → login" ni
  // como "con sesión → dashboard", tiene que resolverse sola.
  // /cotizacion/[token]: el cliente acepta/rechaza sin tener cuenta en el CRM.
  const isPublicPage  = pathname.startsWith('/acceso-denegado') || pathname.startsWith('/organizacion-suspendida') || pathname.startsWith('/restablecer-password') || pathname.startsWith('/cotizacion')

  // ── Sin sesión → login ──────────────────────
  if (!user && !isAuthRoute && !isPublicRoute && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Con sesión en login → dashboard ────────
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Verificar permisos por rol ──────────────
  if (user && !isPublicRoute && !isPublicPage && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, section_access, organization_id')
      .eq('id', user.id)
      .single()

    // Cuenta inactiva
    if (profile && !profile.is_active) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'inactive')
      return NextResponse.redirect(url)
    }

    const role = profile?.role ?? 'soporte'
    const sectionAccess = (profile as any)?.section_access ?? null
    // Explícito: un platform_owner vería los módulos de TODAS las
    // organizaciones sin este filtro (su policy de SELECT bypasea el
    // filtro de organización).
    const orgId = (profile as any)?.organization_id ?? undefined
    const disabledModules = await getDisabledModules(supabase, orgId)

    if (!canAccessRouteWithAccess(role, sectionAccess, pathname, disabledModules)) {
      const url = request.nextUrl.clone()
      url.pathname = '/acceso-denegado'
      url.searchParams.set('from', pathname)
      url.searchParams.set('role', role)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
