'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  CheckSquare,
  FolderOpen,
  Activity,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GlobalSearch from './global-search'

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/pipeline', icon: TrendingUp },
  { label: 'Leads', href: '/leads', icon: Users },
  { label: 'Empresas', href: '/empresas', icon: Building2 },
  { label: 'Tareas', href: '/tareas', icon: CheckSquare },
  { label: 'Proyectos', href: '/proyectos', icon: FolderOpen },
  { label: 'Actividad', href: '/admin/actividad', icon: Activity },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]

// Ítems principales para la barra inferior móvil
const mobileNav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/pipeline', icon: TrendingUp },
  { label: 'Leads', href: '/leads', icon: Users },
  { label: 'Tareas', href: '/tareas', icon: CheckSquare },
  { label: 'Más', href: '/configuracion', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* ── Sidebar desktop ─────────────────────── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col h-full">
        <div className="px-5 py-5 border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-900">CRM</h1>
          <p className="text-xs text-gray-400 mt-0.5">Automatizaciones</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <GlobalSearch />
          {nav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive(href)
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Header móvil ────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">CRM <span className="text-xs text-gray-400 font-normal">Automatizaciones</span></h1>
        <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* ── Bottom nav móvil ────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {mobileNav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors',
              isActive(href) ? 'text-gray-900' : 'text-gray-400'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive(href) ? 'text-gray-900' : 'text-gray-400')} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}
