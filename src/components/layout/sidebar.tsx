'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, TrendingUp, CheckSquare, FolderOpen, Activity, Settings,
  LogOut, UserCog, BarChart3, Bell, GitBranch, CalendarDays, Network, Menu, X, Wallet, Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import GlobalSearch from './global-search'
import { getPermissions, getRoleMeta, canAccessSection } from '@/lib/roles'
import type { NavCounts, UserProfile } from '@/app/(dashboard)/layout'
import type { Role } from '@/lib/roles'
import type { Stage } from '@/lib/stages'
import { getInitials } from '@/lib/format'

interface SidebarProps {
  counts: NavCounts
  profile: UserProfile | null
  isPlatformOwner?: boolean
  stages?: Stage[]
  disabledModules?: Set<string>
  organizationName?: string | null
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  countKey?: keyof NavCounts
  alertKey?: keyof NavCounts
  permission?: keyof ReturnType<typeof getPermissions>
}

const navGroups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard',  href: '/dashboard', icon: LayoutDashboard },
      { label: 'Pipeline',   href: '/pipeline',  icon: TrendingUp, countKey: 'pipeline', permission: 'pipeline' },
      { label: 'Leads',      href: '/leads',     icon: Users,      countKey: 'leads',    permission: 'leads' },
      { label: 'Empresas',   href: '/empresas',  icon: Building2,                         permission: 'empresas' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Tareas',     href: '/tareas',     icon: CheckSquare,  countKey: 'tareasVencidas', alertKey: 'tareasVencidas', permission: 'tareas' },
      { label: 'Proyectos',  href: '/proyectos',  icon: FolderOpen,   countKey: 'proyectos',      permission: 'proyectos' },
      { label: 'Cobranza',   href: '/cobranza',   icon: Wallet,       countKey: 'cobranzaVencida', alertKey: 'cobranzaVencida', permission: 'cobranza' },
      { label: 'Calendario', href: '/calendario', icon: CalendarDays, permission: 'calendario' },
      { label: 'Notificaciones', href: '/notificaciones', icon: Bell, countKey: 'notificaciones', permission: 'notificaciones' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { label: 'Reportes',         href: '/reportes',         icon: BarChart3, permission: 'reportes' },
      { label: 'Automatizaciones', href: '/automatizaciones', icon: GitBranch, permission: 'automatizaciones' },
    ],
  },
  {
    label: 'Organización',
    items: [
      { label: 'Equipo',        href: '/admin/usuarios',  icon: UserCog,  permission: 'usuarios' },
      { label: 'Organigrama',   href: '/organigrama',     icon: Network },
      { label: 'Actividad',     href: '/admin/actividad', icon: Activity, permission: 'actividad' },
      { label: 'Configuración', href: '/configuracion',   icon: Settings, permission: 'configuracion' },
    ],
  },
]

const mobileNavBase: NavItem[] = [
  { label: 'Inicio',   href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/pipeline',  icon: TrendingUp, permission: 'pipeline' },
  { label: 'Tareas',   href: '/tareas',    icon: CheckSquare, permission: 'tareas', countKey: 'tareasVencidas', alertKey: 'tareasVencidas' },
  { label: 'Cobranza', href: '/cobranza',  icon: Wallet, permission: 'cobranza', countKey: 'cobranzaVencida', alertKey: 'cobranzaVencida' },
  { label: 'Avisos',   href: '/notificaciones', icon: Bell, permission: 'notificaciones', countKey: 'notificaciones' },
]

function CountBadge({ count, alert, active }: { count: number; alert: boolean; active?: boolean }) {
  if (count <= 0) return null
  return (
    <span className={cn(
      'ml-auto min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px] font-medium tabular-nums flex items-center justify-center',
      alert ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200' : active ? 'bg-white text-slate-700' : 'text-slate-500'
    )}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function Brand({ organizationName }: { organizationName?: string | null }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold tracking-tight shrink-0" aria-hidden>
        {getInitials(organizationName ?? 'CRM', null, 'C')}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-slate-900 truncate">{organizationName || 'CRM'}</p>
        <p className="text-[11px] text-slate-500">CRM comercial</p>
      </div>
    </div>
  )
}

export default function Sidebar({ counts, profile, isPlatformOwner, stages = [], disabledModules, organizationName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [notifCount, setNotifCount] = useState(counts.notificaciones)
  const [moreOpen, setMoreOpen] = useState(false)
  // Cerrar el menú móvil al navegar, y adoptar el conteo que trae el servidor.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) { setLastPath(pathname); setMoreOpen(false) }
  const [lastServerCount, setLastServerCount] = useState(counts.notificaciones)
  if (counts.notificaciones !== lastServerCount) { setLastServerCount(counts.notificaciones); setNotifCount(counts.notificaciones) }

  useEffect(() => {
    if (!profile?.id) return
    const fetchCount = () =>
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .then(({ count }) => { if (count !== null) setNotifCount(count) })
    // Poll cada 30 s — evita errores de WebSocket en el plan gratuito de Supabase
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [profile?.id, supabase])

  const liveCounts = { ...counts, notificaciones: notifCount }
  const role = (profile?.role ?? 'soporte') as Role
  const roleMeta = getRoleMeta(role)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const sectionKeyOf = (item: NavItem) => item.permission ? String(item.permission) : item.href.replace(/^\//, '').split('/')[0]
  const itemVisible = (item: NavItem) => canAccessSection(role, profile?.section_access ?? null, sectionKeyOf(item), disabledModules)

  const visibleGroups = navGroups.map(g => ({ ...g, items: g.items.filter(itemVisible) })).filter(g => g.items.length > 0)
  const canCreateLeads = canAccessSection(role, profile?.section_access ?? null, 'leads', disabledModules)
  const allowedHrefs = [...visibleGroups.flatMap(g => g.items.map(i => i.href)), ...(canCreateLeads ? ['/leads/nuevo'] : [])]

  const initials = getInitials(profile?.full_name ?? null, profile?.email ?? null, 'U')
  const displayName = profile?.full_name ?? profile?.email ?? 'Usuario'

  const renderLink = (item: NavItem, onNavigate?: () => void, dense = true) => {
    const active = isActive(item.href)
    const Icon = item.icon
    const count = item.countKey ? liveCounts[item.countKey] : 0
    const alert = item.alertKey ? liveCounts[item.alertKey] > 0 : false
    return (
      <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-2.5 px-2.5 rounded-md transition-colors',
          dense ? 'h-8 text-[13px]' : 'h-10 text-sm',
          active ? 'bg-slate-200/70 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
        )}>
        <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-accent-600' : 'text-slate-400 group-hover:text-slate-600')} />
        <span className="truncate">{item.label}</span>
        <CountBadge count={count} alert={alert} active={active} />
      </Link>
    )
  }

  const renderSections = (onNavigate?: () => void, dense = true) => (
    <>
      {visibleGroups.map((group, gi) => (
        <div key={group.label ?? gi} className={gi > 0 ? 'mt-5' : ''}>
          {group.label && <p className="px-2.5 mb-1 text-[11px] font-medium text-slate-400">{group.label}</p>}
          <div className="space-y-px">
            {group.items.map(item => renderLink(item, onNavigate, dense))}
          </div>
        </div>
      ))}
      {isPlatformOwner && (
        <div className="mt-5">
          <p className="px-2.5 mb-1 text-[11px] font-medium text-slate-400">Plataforma</p>
          {renderLink({ label: 'Organizaciones', href: '/plataforma', icon: Globe2 }, onNavigate, dense)}
        </div>
      )}
    </>
  )

  const account = (
    <div className="flex items-center gap-2.5 px-2.5 py-2">
      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-semibold shrink-0" aria-hidden>
        {initials}
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <p className="text-[13px] font-medium text-slate-900 truncate">{displayName}</p>
        <p className="text-[11px] text-slate-500 truncate">{roleMeta.label}</p>
      </div>
      <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"
        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors">
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <>
      {/* ── Escritorio ─────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col h-full bg-sidebar border-r border-slate-200">
        <div className="px-4 h-14 flex items-center">
          <Brand organizationName={organizationName} />
        </div>
        <div className="px-3 pb-3">
          <GlobalSearch stages={stages} allowedHrefs={allowedHrefs} />
        </div>
        <nav className="flex-1 px-2 pb-4 overflow-y-auto" aria-label="Navegación principal">
          {renderSections()}
        </nav>
        <div className="border-t border-slate-200 px-1.5 py-1.5">{account}</div>
      </aside>

      {/* ── Encabezado móvil ───────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-[52px] px-3 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0" aria-hidden>
          {getInitials(organizationName ?? 'CRM', null, 'C')}
        </div>
        <div className="flex-1 min-w-0">
          <GlobalSearch stages={stages} allowedHrefs={allowedHrefs} variant="compact" />
        </div>
        <button onClick={() => setMoreOpen(true)} aria-label="Abrir menú"
          className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
          {initials}
        </button>
      </header>

      {/* ── Navegación inferior móvil ──────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-white border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Navegación rápida">
        {mobileNavBase.filter(itemVisible).slice(0, 4).map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          const count = item.countKey ? liveCounts[item.countKey] : 0
          const alert = item.alertKey ? liveCounts[item.alertKey] > 0 : false
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              className={cn('flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium', active ? 'text-accent-600' : 'text-slate-500')}>
              <span className="relative">
                <Icon className="w-5 h-5" />
                {count > 0 && (
                  <span className={cn('absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[11px] font-semibold tabular-nums flex items-center justify-center text-white',
                    alert ? 'bg-red-600' : 'bg-slate-700')}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium text-slate-500">
          <Menu className="w-5 h-5" />
          Más
        </button>
      </nav>

      {/* ── Menú completo móvil ────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-white rounded-t-2xl flex flex-col max-h-[85vh] shadow-2xl">
            <div className="px-4 h-14 flex items-center justify-between border-b border-slate-200 shrink-0">
              <Brand organizationName={organizationName} />
              <button onClick={() => setMoreOpen(false)} aria-label="Cerrar menú"
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {renderSections(() => setMoreOpen(false), false)}
            </nav>
            <div className="border-t border-slate-200 px-1.5 py-1.5 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.375rem)' }}>
              {account}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
