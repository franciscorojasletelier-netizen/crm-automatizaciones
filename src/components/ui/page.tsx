// Primitivas de página del sistema visual (estándar SaaS sobrio).
// Una sola forma de armar encabezados, paneles, indicadores y estados
// vacíos: las pantallas componen con esto en vez de inventar su propia
// tarjeta con degradé.

import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PageContainer({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-5 md:px-8 md:py-7', wide ? 'max-w-[1600px]' : 'max-w-[1280px]', className)}>
      {children}
    </div>
  )
}

export function PageHeader({ title, description, actions, back }: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 mb-2">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900 text-balance">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

export function Panel({ title, description, actions, children, className, padded = true }: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('bg-white border border-slate-200 rounded-lg shadow-xs', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

type Tone = 'neutral' | 'danger' | 'warning' | 'success' | 'accent'

const TONE_VALUE: Record<Tone, string> = {
  neutral: 'text-slate-900',
  danger: 'text-red-700',
  warning: 'text-amber-700',
  success: 'text-emerald-700',
  accent: 'text-accent-700',
}

/**
 * Indicador: etiqueta, valor y contexto (tendencia, conteo o rango).
 * Toda cifra es una puerta: con href abre las filas que la componen.
 */
export function Stat({ label, value, context, tone = 'neutral', href }: {
  label: string
  value: React.ReactNode
  context?: React.ReactNode
  tone?: Tone
  href?: string
}) {
  const body = (
    <>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums', TONE_VALUE[tone])}>{value}</p>
      {context && <div className="mt-1 text-xs text-slate-500 tabular-nums">{context}</div>}
    </>
  )
  const base = 'block px-4 py-3.5 min-w-0'
  return href
    ? <Link href={href} className={cn(base, 'hover:bg-slate-50 transition-colors focus-visible:relative')}>{body}</Link>
    : <div className={base}>{body}</div>
}

/** Franja de indicadores unida en un solo panel, separados por reglas. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg shadow-xs overflow-hidden [&>*]:bg-white',
      className
    )}>
      {children}
    </div>
  )
}

export function Delta({ value, suffix = '', invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-slate-400">—</span>
  const good = invert ? value < 0 : value > 0
  const color = value === 0 ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-red-700'
  return <span className={cn('font-medium', color)}>{value > 0 ? '+' : ''}{value}{suffix}</span>
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap', className)}>
      {children}
    </span>
  )
}

/** Clases de botón compartidas por <button> y <Link>. */
export const buttonClass = {
  primary: 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-600 text-white text-[13px] font-medium shadow-xs hover:bg-accent-700 disabled:opacity-50 disabled:pointer-events-none transition-colors',
  secondary: 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-800 text-[13px] font-medium shadow-xs hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors',
  ghost: 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-slate-600 text-[13px] font-medium hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:pointer-events-none transition-colors',
  danger: 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-red-200 bg-white text-red-700 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none transition-colors',
}

export const inputClass =
  'w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 disabled:bg-slate-50 disabled:text-slate-500'

export const labelClass = 'block text-[13px] font-medium text-slate-700 mb-1.5'
