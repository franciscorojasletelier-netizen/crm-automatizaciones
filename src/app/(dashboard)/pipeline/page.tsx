export const dynamic = 'force-dynamic'
import { chileDayStart } from '@/lib/dates'
import { requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import KanbanBoard from '@/components/pipeline/kanban-board'
import PipelineSwitcher from '@/components/pipeline/pipeline-switcher'
import { formatCLP } from '@/lib/format'
import { getStages, getPipelines, defaultPipeline, stageByKey } from '@/lib/stages'

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const { pipeline: pipelineParam } = await searchParams
  const { supabase, canEdit, organizationId } = await requirePermission('pipeline')

  const pipelines = await getPipelines(supabase, organizationId ?? undefined)
  const selectedPipeline = (pipelineParam && pipelines.find(p => p.id === pipelineParam)) || defaultPipeline(pipelines)

  const stages = await getStages(supabase, organizationId ?? undefined, selectedPipeline?.id)


  // Fetch TODAS las etapas: activas + ganadas/perdidas recientes (90 días)
  const ninetyDaysAgo = chileDayStart(-90).toISOString()

  let query = supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action, last_contacted_at, created_at,
      companies(name),
      contacts:primary_contact_id(full_name),
      profiles:owner_id(full_name)
    `)
    .or(`status.eq.open,and(status.in.(won,lost),closed_at.gte.${ninetyDaysAgo})`)
    .order('score', { ascending: false })
    .limit(300)

  if (selectedPipeline) query = query.eq('pipeline_id', selectedPipeline.id)

  // Visibilidad por rol: la aplica la RLS de deals.

  const { data: deals } = await query

  // Stats header — cuentan los deals que siguen abiertos. Una etapa
  // terminal pero no resuelta (tipo "Frío") sigue sumando, igual que antes.
  const activeDeals = deals?.filter(d => {
    const s = stageByKey(stages, d.stage)
    return !s?.isWon && !s?.isLost
  }) ?? []
  const totalValue  = activeDeals.reduce((sum, d) => sum + (Number(d.estimated_value) || 0), 0)

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900">Pipeline</h1>
            {pipelines.length > 1 && <PipelineSwitcher pipelines={pipelines} selectedId={selectedPipeline?.id ?? ''} />}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{activeDeals.length}</span> {activeDeals.length === 1 ? 'deal activo' : 'deals activos'}
            </p>
            {totalValue > 0 && (
              <>
                <span className="text-sm text-slate-400">·</span>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{formatCLP(totalValue)}</span> en pipeline
                </p>
              </>
            )}
          </div>
        </div>
        {canEdit && (
          <Link href={selectedPipeline ? `/leads/nuevo?pipeline=${selectedPipeline.id}` : '/leads/nuevo'}
            className="bg-accent-600 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-xs transition-all hover:-translate-y-0.5"
             >
            <Plus className="w-4 h-4" />
            Nuevo lead
          </Link>
        )}
      </div>

      {/* Kanban con drag & drop */}
      <KanbanBoard initialDeals={(deals ?? []) as unknown as React.ComponentProps<typeof KanbanBoard>['initialDeals']} readOnly={!canEdit} organizationId={organizationId ?? ''} stages={stages} />
    </div>
  )
}
