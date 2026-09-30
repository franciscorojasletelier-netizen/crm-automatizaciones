import { CHILE_TZ } from '@/lib/dates'

// Tiempo relativo. 'short' (5m, 2h) para chats; 'long' (Hace 5m) para
// listas e historiales. Pasado un día muestra la fecha.
export function timeAgo(date: string | Date, style: 'short' | 'long' = 'long', withYear = false): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 1) return 'Ahora'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) {
    const v = mins < 60 ? `${mins}m` : `${hrs}h`
    return style === 'short' ? v : `Hace ${v}`
  }
  return new Date(date).toLocaleDateString('es-CL', {
    timeZone: CHILE_TZ, day: '2-digit', month: 'short', ...(withYear ? { year: '2-digit' } : {}),
  })
}

// Iniciales para avatares: "Ana María Pérez" → "AM".
export function getInitials(name: string | null | undefined, email?: string | null, fallback = '?'): string {
  if (name?.trim()) return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return fallback
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Formato de moneda del CRM: pesos chilenos (CLP)
// CLP no usa decimales; separador de miles con puntos. Ej: $5.000.000
export function formatCLP(value: number | string | null | undefined): string {
  const n = Number(value)
  if (!value || isNaN(n)) return '—'
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}
