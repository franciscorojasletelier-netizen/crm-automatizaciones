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
  dashboard:        boolean
  pipeline:         boolean
  leads:            boolean
  empresas:         'full' | 'read' | 'none'
  tareas:           'full' | 'read' | 'none'
  proyectos:        'full' | 'read' | 'none'
  actividad:        boolean
  usuarios:         boolean
  configuracion:    boolean
  reportes:         boolean
  notificaciones:   boolean
  automatizaciones: boolean
  calendario:       boolean

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
    dashboard: true, pipeline: true, leads: true,
    empresas: 'full', tareas: 'full', proyectos: 'full',
    actividad: true, usuarios: true, configuracion: true,
    reportes: true, notificaciones: true, automatizaciones: true, calendario: true,
    canDeleteDeals: true, canDeleteProjects: true, canExportData: true,
    canManageUsers: true, canViewFinancials: true, canCreateLeads: true,
    canEditDeals: true, canEditProjects: true,
  },
  gerente: {
    dashboard: true, pipeline: true, leads: true,
    empresas: 'full', tareas: 'full', proyectos: 'full',
    actividad: true, usuarios: true, configuracion: false,
    reportes: true, notificaciones: true, automatizaciones: true, calendario: true,
    canDeleteDeals: false, canDeleteProjects: false, canExportData: true,
    canManageUsers: true, canViewFinancials: true, canCreateLeads: true,
    canEditDeals: true, canEditProjects: true,
  },
  comercial: {
    dashboard: true, pipeline: true, leads: true,
    empresas: 'full', tareas: 'full', proyectos: 'none',
    actividad: false, usuarios: false, configuracion: false,
    reportes: false, notificaciones: true, automatizaciones: false, calendario: true,
    canDeleteDeals: false, canDeleteProjects: false, canExportData: false,
    canManageUsers: false, canViewFinancials: true, canCreateLeads: true,
    canEditDeals: true, canEditProjects: false,
  },
  produccion: {
    dashboard: true, pipeline: false, leads: false,
    empresas: 'read', tareas: 'full', proyectos: 'full',
    actividad: false, usuarios: false, configuracion: false,
    reportes: false, notificaciones: true, automatizaciones: false, calendario: true,
    canDeleteDeals: false, canDeleteProjects: false, canExportData: false,
    canManageUsers: false, canViewFinancials: false, canCreateLeads: false,
    canEditDeals: false, canEditProjects: true,
  },
  soporte: {
    dashboard: true, pipeline: false, leads: false,
    empresas: 'none', tareas: 'read', proyectos: 'read',
    actividad: false, usuarios: false, configuracion: false,
    reportes: false, notificaciones: true, automatizaciones: false, calendario: true,
    canDeleteDeals: false, canDeleteProjects: false, canExportData: false,
    canManageUsers: false, canViewFinancials: false, canCreateLeads: false,
    canEditDeals: false, canEditProjects: false,
  },
}

// ── Secciones navegables (para el checklist de acceso) ──────
export interface NavSection {
  key: string
  label: string
  permission?: keyof RolePermissions // permiso base del rol que la habilita (techo)
}

export const NAV_SECTIONS: NavSection[] = [
  { key: 'dashboard',        label: 'Dashboard',        permission: 'dashboard' },
  { key: 'pipeline',         label: 'Pipeline',         permission: 'pipeline' },
  { key: 'leads',            label: 'Leads',            permission: 'leads' },
  { key: 'empresas',         label: 'Empresas',         permission: 'empresas' },
  { key: 'tareas',           label: 'Tareas',           permission: 'tareas' },
  { key: 'proyectos',        label: 'Proyectos',        permission: 'proyectos' },
  { key: 'calendario',       label: 'Calendario',       permission: 'calendario' },
  { key: 'organigrama',      label: 'Organigrama' }, // todos
  { key: 'notificaciones',   label: 'Notificaciones',   permission: 'notificaciones' },
  { key: 'reportes',         label: 'Reportes',         permission: 'reportes' },
  { key: 'automatizaciones', label: 'Automatizaciones', permission: 'automatizaciones' },
  { key: 'actividad',        label: 'Actividad',        permission: 'actividad' },
  { key: 'usuarios',         label: 'Equipo / Usuarios', permission: 'usuarios' },
  { key: 'configuracion',    label: 'Configuración',    permission: 'configuracion' },
]

// Acceso por sección: 'full' (ver y editar) | 'read' (solo lectura) | sin acceso.
export type SectionMode = 'full' | 'read'
// Formato nuevo: objeto { seccion: 'full' | 'read' }. Formato legacy: array de keys (= 'full').
export type SectionAccess = Record<string, SectionMode> | string[] | null | undefined

function hasSectionEntry(sectionAccess: SectionAccess, key: string): boolean {
  if (Array.isArray(sectionAccess)) return sectionAccess.includes(key)
  if (sectionAccess && typeof sectionAccess === 'object') return key in sectionAccess
  return false
}

// ¿Puede el usuario ACCEDER (ver) a una sección?
// Tres niveles, en orden de "techo": organización (módulos habilitados) >
// rol (qué permite como máximo) > section_access (filtro restrictivo por
// usuario). Cualquiera de los tres puede negar; ninguno puede otorgar más
// de lo que el nivel de arriba ya permitió.
// disabledModules ausente/undefined => no se restringe por organización
// (comportamiento previo a la Fase 4, y fail-open si no se cargó el dato).
export function canAccessSection(
  role: string,
  sectionAccess: SectionAccess,
  key: string,
  disabledModules?: Set<string> | null
): boolean {
  if (disabledModules?.has(key)) return false
  const section = NAV_SECTIONS.find(s => s.key === key)
  const base = section?.permission ? hasPermission(role, section.permission) : true
  if (sectionAccess == null) return base
  return base && hasSectionEntry(sectionAccess, key)
}

// Modo efectivo de una sección: 'none' | 'read' | 'full'
export function getSectionMode(
  role: string,
  sectionAccess: SectionAccess,
  key: string,
  disabledModules?: Set<string> | null
): 'none' | SectionMode {
  if (!canAccessSection(role, sectionAccess, key, disabledModules)) return 'none'
  // Legacy (array) o sin checklist (null) => acceso completo
  if (sectionAccess == null || Array.isArray(sectionAccess)) return 'full'
  return sectionAccess[key] === 'read' ? 'read' : 'full'
}

// ¿Puede EDITAR en una sección (no es solo lectura)?
export function canEditSection(
  role: string,
  sectionAccess: SectionAccess,
  key: string,
  disabledModules?: Set<string> | null
): boolean {
  return getSectionMode(role, sectionAccess, key, disabledModules) === 'full'
}

// ── Helpers ────────────────────────────────────

// Mapeo de roles viejos → nuevos (compatibilidad hacia atrás)
const LEGACY_ROLE_MAP: Record<string, Role> = {
  admin:       'super_admin',
  operaciones: 'produccion',
  finanzas:    'soporte',
}

export function normalizeRole(role: string): Role {
  if (role in PERMISSIONS) return role as Role
  if (role in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[role]
  return 'soporte'
}

export function getPermissions(role: string): RolePermissions {
  return PERMISSIONS[normalizeRole(role)]
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
  return ROLE_META[normalizeRole(role)]
}

// Rutas protegidas y los roles que pueden acceder
export const PROTECTED_ROUTES: Array<{
  pattern: RegExp
  permission: keyof RolePermissions
}> = [
  { pattern: /^\/pipeline/,          permission: 'pipeline' },
  { pattern: /^\/leads/,             permission: 'leads' },
  { pattern: /^\/admin\/usuarios/,   permission: 'usuarios' },
  { pattern: /^\/admin/,             permission: 'actividad' },
  { pattern: /^\/configuracion/,     permission: 'configuracion' },
  { pattern: /^\/reportes/,          permission: 'reportes' },
  { pattern: /^\/automatizaciones/,  permission: 'automatizaciones' },
]

export function canAccessRoute(role: string, pathname: string): boolean {
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      return hasPermission(role, route.permission)
    }
  }
  return true // rutas no protegidas son accesibles
}

// Mapeo de rutas a secciones del checklist
export const ROUTE_SECTIONS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /^\/dashboard/,        key: 'dashboard' },
  { pattern: /^\/pipeline/,         key: 'pipeline' },
  { pattern: /^\/leads/,            key: 'leads' },
  { pattern: /^\/empresas/,         key: 'empresas' },
  { pattern: /^\/tareas/,           key: 'tareas' },
  { pattern: /^\/proyectos/,        key: 'proyectos' },
  { pattern: /^\/calendario/,       key: 'calendario' },
  { pattern: /^\/organigrama/,      key: 'organigrama' },
  { pattern: /^\/notificaciones/,   key: 'notificaciones' },
  { pattern: /^\/reportes/,         key: 'reportes' },
  { pattern: /^\/automatizaciones/, key: 'automatizaciones' },
  { pattern: /^\/admin\/usuarios/,  key: 'usuarios' },
  { pattern: /^\/admin/,            key: 'actividad' },
  { pattern: /^\/configuracion/,    key: 'configuracion' },
]

// Versión que respeta el checklist por usuario (section_access) además del rol
export function canAccessRouteWithAccess(
  role: string,
  sectionAccess: SectionAccess,
  pathname: string,
  disabledModules?: Set<string> | null
): boolean {
  for (const r of ROUTE_SECTIONS) {
    if (r.pattern.test(pathname)) {
      return canAccessSection(role, sectionAccess, r.key, disabledModules)
    }
  }
  return true // rutas no mapeadas son accesibles
}

// Redirección por defecto según rol
export function getDefaultRoute(role: string): string {
  const perms = getPermissions(role)
  if (perms.dashboard) return '/dashboard'
  if (perms.proyectos !== 'none') return '/proyectos'
  return '/tareas'
}
