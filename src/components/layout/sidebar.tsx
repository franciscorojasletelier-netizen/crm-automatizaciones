'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, TrendingUp,
  CheckSquare, FolderOpen, Activity, Settings,
  LogOut, Zap, UserCog, BarChart3, Bell, GitBranch, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GlobalSearch from './global-search'
import { getPermissions, getRoleMeta } from '@/lib/roles'
import type { NavCounts, UserProfile } from '@/app/(dashboard)/layout'
import type { Role } from '@/lib/roles'

interface SidebarProps {
  counts: NavCounts
  profile: UserProfile | null
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  countKey?: keyof NavCounts
  alertKey?: keyof NavCounts
  permission?: keyof ReturnType<typeof getPermissions>
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard',       href: '/dashboard',       icon: LayoutDashboard },
      { label: 'Pipeline',        href: '/pipeline',        icon: TrendingUp,   countKey: 'pipeline',       permission: 'pipeline' },
      { label: 'Leads',           href: '/leads',           icon: Users,        countKey: 'leads',          permission: 'leads' },
      { label: 'Empresas',        href: '/empresas',        icon: Building2,    countKey: 'empresas',       permission: 'empresas' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Tareas',          href: '/tareas',          icon: CheckSquare,  countKey: 'tareas',         alertKey: 'tareasVencidas', permission: 'tareas' },
      { label: 'Proyectos',       href: '/proyectos',       icon: FolderOpen,   countKey: 'proyectos',      permission: 'proyectos' },
      { label: 'Calendario',      href: '/calendario',      icon: CalendarDays,                              permission: 'calendario' },
      { label: 'Notificaciones',  href: '/notificaciones',  icon: Bell,         countKey: 'notificaciones', alertKey: 'notificaciones', permission: 'notificaciones' },
    ],
  },
  {
    label: 'Inteligencia',
    items: [
      { label: 'Reportes',        href: '/reportes',        icon: BarChart3,                                permission: 'reportes' },
      { label: 'Automatizaciones',href: '/automatizaciones',icon: GitBranch,                                permission: 'automatizaciones' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Equipo',          href: '/admin/usuarios',  icon: UserCog,                                  permission: 'usuarios' },
      { label: 'Actividad',       href: '/admin/actividad', icon: Activity,                                 permission: 'actividad' },
      { label: 'Configuración',   href: '/configuracion',   icon: Settings,                                 permission: 'configuracion' },
    ],
  },
]

const mobileNavBase: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline',  href: '/pipeline',  icon: TrendingUp,   permission: 'pipeline' },
  { label: 'Leads',     href: '/leads',     icon: Users,        permission: 'leads' },
  { label: 'Proyectos', href: '/proyectos', icon: FolderOpen,   permission: 'proyectos' },
  { label: 'Tareas',    href: '/tareas',    icon: CheckSquare,  permission: 'tareas' },
]

function getInitials(name: string | null, email: string | null): string {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export default function Sidebar({ counts, profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const role = (profile?.role ?? 'soporte') as Role
  const perms = getPermissions(role)
  const roleMeta = getRoleMeta(role)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Filtrar items según permisos
  function itemVisible(item: NavItem): boolean {
    if (!item.permission) return true
    const val = perms[item.permission]
    if (typeof val === 'boolean') return val
    return val !== 'none'
  }

  const initials = getInitials(profile?.full_name ?? null, profile?.email ?? null)
  const displayName = profile?.full_name ?? profile?.email ?? 'Usuario'

  return (
    <>
      {/* ── Sidebar desktop ─────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col h-full relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>

        {/* Glow decorativo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

        {/* Logo */}
        <div className="px-5 py-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">CRM</h1>
              <p className="text-[10px] text-indigo-300/70 leading-none mt-0.5">Automatizaciones</p>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px bg-white/5" />

        {/* Búsqueda */}
        <div className="px-3 py-3 relative z-10">
          <GlobalSearch />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto space-y-4 relative z-10">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(itemVisible)
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25 select-none">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(({ label, href, icon: Icon, countKey, alertKey }) => {
                    const active = isActive(href)
                    const count = countKey ? counts[countKey] : null
                    const alertCount = alertKey ? counts[alertKey] : 0
                    const hasAlert = alertCount > 0

                    return (
                      <Link key={href} href={href}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative',
                          active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        )}>
                        {active && (
                          <span className="absolute inset-0 rounded-xl"
                            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.2))' }} />
                        )}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                            style={{ background: 'linear-gradient(to bottom, #818cf8, #a78bfa)' }} />
                        )}
                        <Icon className={cn('w-4 h-4 shrink-0 relative z-10 transition-transform duration-200',
                          active ? 'text-indigo-300' : 'group-hover:scale-110')} />
                        <span className="flex-1 relative z-10 font-medium">{label}</span>
                        {count !== null && count > 0 && (
                          <span className={cn(
                            'relative z-10 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all',
                            hasAlert
                              ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500/40'
                              : active
                                ? 'bg-indigo-400/30 text-indigo-200'
                                : 'bg-white/10 text-slate-300 group-hover:bg-white/15'
                          )}>
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                        {hasAlert && !active && (
                          <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer — perfil + logout */}
        <div className="px-3 py-4 border-t border-white/5 relative z-10 space-y-2">
          {/* Info de usuario */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
          </div>

          <button onClick={handleLogout}
            className="group flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200">
            <LogOut className="w-4 h-4 shrink-0 group-hover:rotate-12 transition-transform duration-200" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Header móvil ────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap className="w-3 h-3 text-white" />
          </div>
          <h1 className="text-sm font-bold text-white">CRM</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ring-1 ${roleMeta.color}`}>
            {roleMeta.label}
          </span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Bottom nav móvil ────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
        style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {mobileNavBase.filter(itemVisible).slice(0, 5).map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-indigo-300' : 'text-slate-500'
              )}>
              <Icon className={cn('w-5 h-5', active ? 'text-indigo-300' : 'text-slate-500')} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
