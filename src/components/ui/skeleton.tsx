// Esqueletos de carga: misma geometría que PageHeader, StatStrip y Panel,
// para que el cambio de sección se vea instantáneo y sin saltos al llegar
// los datos.

import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/ui/page'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />
}

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="space-y-2"><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-56" /></div>
      {action && <Skeleton className="h-8 w-32" />}
    </div>
  )
}

function StatsSkeleton({ count }: { count: number }) {
  return (
    <div className={cn('grid gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden mb-4',
      count === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-card px-4 py-3.5 space-y-2">
          <Skeleton className="h-3.5 w-20" /><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bg-card border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex gap-2">
        <Skeleton className="h-8 w-64" /><Skeleton className="h-8 w-24 hidden sm:block" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="px-4 h-12 flex items-center gap-4 border-b border-slate-100 last:border-0">
          <Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

/** Esqueleto genérico de página: encabezado + indicadores + tabla. */
export function PageSkeleton({ stats = 4, rows = 8, action = true, wide = false }: {
  stats?: number; rows?: number; action?: boolean; wide?: boolean
}) {
  return (
    <PageContainer wide={wide}>
      <span className="sr-only" role="status">Cargando…</span>
      <HeaderSkeleton action={action} />
      {stats > 0 && <StatsSkeleton count={stats} />}
      <TableSkeleton rows={rows} />
    </PageContainer>
  )
}

/** Esqueleto del tablero kanban. */
export function BoardSkeleton() {
  return (
    <PageContainer wide>
      <span className="sr-only" role="status">Cargando…</span>
      <HeaderSkeleton />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-[272px] shrink-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24 opacity-60" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
