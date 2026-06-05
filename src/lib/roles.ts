// ─────────────────────────────────────────────
//  SISTEMA DE ROLES Y PERMISOS — CRM
// ─────────────────────────────────────────────

export type Role = 'super_admin' | 'gerente' | 'comercial' | 'produccion' | 'soporte'

// ── Definición de roles ────────────────────────
export const ROLE_META: Record<Role, {
  label: string
  description: string
  color: string
  badge: string
  level: number // jerarquía: mayor = más poder
}> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Acceso total al sistema, gestión de usuarios y configuración técnica',
    color: 'text-purple-700 bg-purple-100 ring-purple-200',
    badge: 'bg-purple-500',
    level: 5,
  },
  gerente: {
    label: 'Gerente',
    description: 'Visibilidad completa del negocio, reportes y gestión de equipo',
    color: 'text-indigo-700 bg-indigo-100 ring-indigo-200',
    badge: 'bg-indigo-500',
    level: 4,
  },
  comercial: {
    label: 'Ejecutivo de Ventas',
    description: 'Gestión completa de leads, pipeline, empresas y tareas comerciales',
    color: 'text-blue-700 bg-blue-100 ring-blue-200',
    badge: 'bg-blue-500',
    level: 3,
  },
  produccion: {
    label: 'Producción',
    description: 'Gestión de proyectos y tareas. Ve empresas en modo lectura',
    color: 'text-amber-700 bg-amber-100 ring-amber-200',
    badge: 'bg-amber-500',
    level: 2,
  },
  soporte: {
    label: 'Soporte / Analista',
    description: 'Dashboard de KPIs y tareas en modo lectura. Sin acceso a datos sensibles',
    color: 'text-slate-700 bg-slate-100 ring-slate-200',
    badge: 'bg-slate-400',
    level: 1,
  },
}

// ── Matriz de permisos ─────────────────────────
export interface RolePermissions {
  // Navegación / Acceso a secciones
  dashboard:     boolean
  pipeline:      boolean
  leads:         boolean
  empresas:      'full' | 'read' | 'none'
  tareas:        'full' | 'read' | 'none'
  proyectos:     'full' | 'read' | 'none'
  actividad:     boolean
  usuarios:      boolean
  configuracion: boolean

  // Acciones específicas
  canDeleteDeals:    boolean
  canDeleteProjects: boolean
  canExportData:     boolean
  canManageUsers:    boolean
  canViewFinancials: boolean // valores de deals, presupuestos
  canCreateLeads:    boolean
  canEditDeals:      boolean
  canEditProjects:   boolean
}

export const PERMISSIONS: Record<Role, RolePermissions> = {
  super_admin: {
    dashboard: true,
    pipeline: true,
    leads: true,
    empresas: 'full',
    tareas: 'full',
    proyectos: 'full',
    actividad: true,
    usuarios: true,
    configuracion: true,
    canDeleteDeals: true,
    canDeleteProjects: true,
    canExportData: true,
    canManageUsers: true,
    canViewFinancials: true,
    canCreateLeads: true,
    canEditDeals: true,
    canEditProjects: true,
  },
  gerente: {
    dashboard: true,
    pipeline: true,
    leads: true,
    empresas: 'full',
    tareas: 'full',
    proyectos: 'full',
    actividad: true,
    usuarios: true,
    configuracion: false,
    canDeleteDeals: false,
    canDeleteProjects: false,
    canExportData: true,
    canManageUsers: true,
    canViewFinancials: true,
    canCreateLeads: true,
    canEditDeals: true,
    canEditProjects: true,
  },
  comercial: {
    dashboard: true,
    pipeline: true,
    leads: true,
    empresas: 'full',
    tareas: 'full',
    proyectos: 'none',
    actividad: false,
    usuarios: false,
    configuracion: false,
    canDeleteDeals: false,
    canDeleteProjects: false,
    canExportData: false,
    canManageUsers: false,
    canViewFinancials: true,
    canCreateLeads: true,
    canEditDeals: true,
    canEditProjects: false,
  },
  produccion: {
    dashboard: true,
    pipeline: false,
    leads: false,
    empresas: 'read',
    tareas: 'full',
    proyectos: 'full',
    actividad: false,
    usuarios: false,
    configuracion: false,
    canDeleteDeals: false,
    canDeleteProjects: false,
    canExportData: false,
    canManageUsers: false,
    canViewFinancials: false,
    canCreateLeads: false,
    canEditDeals: false,
    canEditProjects: true,
  },
  soporte: {
    dashboard: true,
    pipeline: false,
    leads: false,
    empresas: 'none',
    tareas: 'read',
    proyectos: 'read',
    actividad: false,
    usuarios: false,
    configuracion: false,
    canDeleteDeals: false,
    canDeleteProjects: false,
    canExportData: false,
    canManageUsers: false,
    canViewFinancials: false,
    canCreateLeads: false,
    canEditDeals: false,
    canEditProjects: false,
  },
}

// ── Helpers ────────────────────────────────────

export function getPermissions(role: string): RolePermissions {
  return PERMISSIONS[role as Role] ?? PERMISSIONS.soporte
}

export function hasPermission<K extends keyof RolePermissions>(
  role: string,
  permission: K
): boolean {
  const perms = getPermissions(role)
  const val = perms[permission]
  if (typeof val === 'boolean') return val
  return val !== 'none'
}

export function canEdit(role: string, section: 'empresas' | 'tareas' | 'proyectos'): boolean {
  return getPermissions(role)[section] === 'full'
}

export function getRoleMeta(role: string) {
  return ROLE_META[role as Role] ?? ROLE_META.soporte
}

// Rutas protegidas y los roles que pueden acceder
export const PROTECTED_ROUTES: Array<{
  pattern: RegExp
  permission: keyof RolePermissions
}> = [
  { pattern: /^\/pipeline/, permission: 'pipeline' },
  { pattern: /^\/leads/,    permission: 'leads' },
  { pattern: /^\/admin\/usuarios/, permission: 'usuarios' },
  { pattern: /^\/admin/,    permission: 'actividad' },
  { pattern: /^\/configuracion/, permission: 'configuracion' },
]

export function canAccessRoute(role: string, pathname: string): boolean {
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      return hasPermission(role, route.permission)
    }
  }
  return true // rutas no protegidas son accesibles
}

// Redirección por defecto según rol
export function getDefaultRoute(role: string): string {
  const perms = getPermissions(role)
  if (perms.dashboard) return '/dashboard'
  if (perms.proyectos !== 'none') return '/proyectos'
  return '/tareas'
}
