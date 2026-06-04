import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DealStageSelector from '@/components/deals/deal-stage-selector'
import DealInteractions from '@/components/deals/deal-interactions'
import DealTasks from '@/components/deals/deal-tasks'
import DeleteDealButton from '@/components/deals/delete-deal-button'
import DealEditFields from '@/components/deals/deal-edit-fields'

const stageColors: Record<string, string> = {
  nuevo_lead: 'bg-blue-100 text-blue-700',
  contactado: 'bg-yellow-100 text-yellow-700',
  calificado: 'bg-purple-100 text-purple-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_realizada: 'bg-cyan-100 text-cyan-700',
  propuesta_enviada: 'bg-orange-100 text-orange-700',
  negociacion: 'bg-pink-100 text-pink-700',
  cerrado_ganado: 'bg-green-100 text-green-700',
  cerrado_perdido: 'bg-red-100 text-red-700',
  no_calificado: 'bg-gray-100 text-gray-600',
  frio: 'bg-slate-100 text-slate-600',
}

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead',
  contactado: 'Contactado',
  calificado: 'Calificado',
  reunion_agendada: 'Reunión Agendada',
  reunion_realizada: 'Reunión Realizada',
  propuesta_enviada: 'Propuesta Enviada',
  negociacion: 'Negociación',
  cerrado_ganado: 'Cerrado Ganado',
  cerrado_perdido: 'Cerrado Perdido',
  no_calificado: 'No Calificado',
  frio: 'Frío',
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select(`
      *,
      companies(*),
      contacts:primary_contact_id(*),
      profiles:owner_id(full_name)
    `)
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const { data: history } = await supabase
    .from('pipeline_stage_history')
    .select('*, profiles:changed_by(full_name)')
    .eq('deal_id', id)
    .order('changed_at', { ascending: false })

  const { data: interactions } = await supabase
    .from('interactions')
    .select('*, profiles:user_id(full_name)')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, profiles:assigned_to(full_name)')
    .eq('deal_id', id)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link href="/leads" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a leads
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{deal.companies?.name ?? 'Sin empresa'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{deal.contacts?.full_name ?? ''} · {deal.contacts?.email ?? ''}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${stageColors[deal.stage]}`}>
              {stageLabels[deal.stage]}
            </span>
            <DeleteDealButton
              dealId={deal.id}
              companyId={deal.company_id}
              contactId={deal.primary_contact_id}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna izquierda — info + etapa + historial */}
        <div className="col-span-1 space-y-4">

          {/* Datos del deal */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles</h2>
            <DealEditFields deal={deal} />
            {deal.expected_close_date && (
              <div>
                <p className="text-xs text-gray-400">Cierre esperado</p>
                <p className="text-sm text-gray-800">{new Date(deal.expected_close_date).toLocaleDateString('es-CL')}</p>
              </div>
            )}
            {deal.profiles?.full_name && (
              <div>
                <p className="text-xs text-gray-400">Responsable</p>
                <p className="text-sm text-gray-800">{deal.profiles.full_name}</p>
              </div>
            )}
            {deal.score != null && (
              <div>
                <p className="text-xs text-gray-400">Score</p>
                <p className="text-sm text-gray-800">{deal.score}</p>
              </div>
            )}
          </div>

          {/* Empresa */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</h2>
            {[
              { label: 'Nombre', value: deal.companies?.name },
              { label: 'Industria', value: deal.companies?.industry },
              { label: 'Web', value: deal.companies?.website },
              { label: 'País', value: deal.companies?.country },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm text-gray-800">{value}</p>
              </div>
            ) : null)}
          </div>

          {/* Historial de etapas */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial de etapas</h2>
              <div className="space-y-2">
                {history.map((h: any) => (
                  <div key={h.id} className="text-xs text-gray-500">
                    <span className="text-gray-400">{new Date(h.changed_at).toLocaleDateString('es-CL')}</span>
                    {' · '}
                    <span>{stageLabels[h.from_stage] ?? h.from_stage}</span>
                    {' → '}
                    <span className="text-gray-800 font-medium">{stageLabels[h.to_stage] ?? h.to_stage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha — etapa + interacciones + tareas */}
        <div className="col-span-2 space-y-4">
          <DealStageSelector dealId={deal.id} currentStage={deal.stage} />
          <DealInteractions dealId={deal.id} interactions={interactions ?? []} />
          <DealTasks dealId={deal.id} tasks={tasks ?? []} />
        </div>
      </div>
    </div>
  )
}
