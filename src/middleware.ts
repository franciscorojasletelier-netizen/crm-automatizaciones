import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessRoute, getDefaultRoute } from '@/lib/roles'

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  // ── Sin sesión → login ──────────────────────
  if (!user) {
    if (pathname.startsWith('/login')) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Con sesión en login → dashboard ────────
  if (pathname === '/login' || pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Verificar permisos por rol ──────────────
  // Solo en rutas del dashboard, no en APIs ni estáticos
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
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

    // Verificar acceso a la ruta
    if (!canAccessRoute(role, pathname)) {
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
