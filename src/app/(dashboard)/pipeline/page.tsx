export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getVisibleDealIds } from '@/lib/visibility'
import KanbanBoard from '@/components/pipeline/kanban-board'

export default async function PipelinePage() {
  const { role, supabase, user, canEdit } = await requirePermission('pipeline')

  const visibleIds = await getVisibleDealIds(supabase, user?.id ?? '', role)

  // Fetch TODAS las etapas: activas + ganadas/perdidas recientes (90 días)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action, last_contacted_at, created_at,
      companies(name),
      contacts:primary_contact_id(full_name),
      profiles:owner_id(full_name)
    `)
    .or(`status.eq.open,and(status.in.(won,lost),updated_at.gte.${ninetyDaysAgo})`)
    .order('score', { ascending: false })
    .limit(300)

  if (visibleIds !== null) {
    query = visibleIds.length > 0
      ? query.in('id', visibleIds)
      : query.eq('id', 'no-match')
  }

  const { data: deals } = await query

  // Stats header
  const activeDeals = deals?.filter(d => !['cerrado_ganado','cerrado_perdido','no_calificado'].includes((d as any).stage)) ?? []
  const totalValue  = activeDeals.reduce((sum, d: any) => sum + (Number(d.estimated_value) || 0), 0)

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{activeDeals.length}</span> deals activos
            </p>
            {totalValue > 0 && (
              <>
                <span className="text-sm text-slate-400">·</span>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">${totalValue.toLocaleString()}</span> en pipeline
                </p>
              </>
            )}
          </div>
        </div>
        {canEdit && (
          <Link href="/leads/nuevo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus className="w-4 h-4" />
            Nuevo lead
          </Link>
        )}
      </div>

      {/* Kanban con drag & drop */}
      <KanbanBoard initialDeals={(deals ?? []) as any} readOnly={!canEdit} />
    </div>
  )
}
