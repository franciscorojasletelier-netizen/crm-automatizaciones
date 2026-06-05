export const dynamic = 'force-dynamic'
import { createClient, requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, TrendingUp } from 'lucide-react'
import { getVisibleDealIds } from '@/lib/visibility'

const stages = [
  { key: 'nuevo_lead',       label: 'Nuevo Lead',        color: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  { key: 'contactado',       label: 'Contactado',         color: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  { key: 'calificado',       label: 'Calificado',         color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { key: 'reunion_agendada', label: 'Reunión Agendada',   color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { key: 'reunion_realizada',label: 'Reunión Realizada',  color: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200'   },
  { key: 'propuesta_enviada',label: 'Propuesta Enviada',  color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { key: 'negociacion',      label: 'Negociación',        color: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'   },
]

export default async function PipelinePage() {
  const { role, supabase, user } = await requirePermission('pipeline')

  const visibleIds = await getVisibleDealIds(supabase, user?.id ?? '', role)

  let baseQuery = supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action,
      companies(name),
      contacts:primary_contact_id(full_name),
      profiles:owner_id(full_name)
    `)
    .eq('status', 'open')
    .not('stage', 'in', '("cerrado_ganado","cerrado_perdido","no_calificado","frio")')
    .order('score', { ascending: false })

  if (visibleIds !== null) {
    baseQuery = visibleIds.length > 0
      ? baseQuery.in('id', visibleIds)
      : baseQuery.eq('id', 'no-match')
  }

  const { data: deals } = await baseQuery

  const byStage = stages.reduce((acc, s) => {
    acc[s.key] = deals?.filter((d: any) => d.stage === s.key) ?? []
    return acc
  }, {} as Record<string, any[]>)

  const totalValue = deals?.reduce((sum, d: any) => sum + (Number(d.estimated_value) || 0), 0) ?? 0

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{deals?.length ?? 0}</span> deals activos
            </p>
            {totalValue > 0 && (
              <span className="text-sm text-slate-400">·</span>
            )}
            {totalValue > 0 && (
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">${totalValue.toLocaleString()}</span> en pipeline
              </p>
            )}
          </div>
        </div>
        <Link href="/leads/nuevo"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Plus className="w-4 h-4" />
          Nuevo lead
        </Link>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
        {stages.map(stage => (
          <div key={stage.key} className="flex flex-col min-w-[230px] w-[230px] flex-shrink-0">

            {/* Column header */}
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <div className={`w-2.5 h-2.5 rounded-full ${stage.color} shadow-sm`} />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex-1 truncate">
                {stage.label}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.light} ${stage.text}`}>
                {byStage[stage.key].length}
              </span>
            </div>

            {/* Drop zone */}
            <div className="flex flex-col gap-2 min-h-[80px]">
              {byStage[stage.key].length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl h-20 flex items-center justify-center bg-white/50">
                  <p className="text-xs text-slate-300 font-medium">Sin deals</p>
                </div>
              ) : (
                byStage[stage.key].map((deal: any) => (
                  <Link key={deal.id} href={`/leads/${deal.id}`}
                    className="group bg-white border border-slate-200 rounded-xl p-3.5 hover:border-indigo-300 hover:shadow-md transition-all duration-200 block relative overflow-hidden">

                    {/* Barra de color top */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${stage.color} opacity-60`} />

                    {/* Empresa */}
                    <p className="text-sm font-bold text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors">
                      {deal.companies?.name ?? 'Sin empresa'}
                    </p>

                    {/* Contacto */}
                    {deal.contacts?.full_name && (
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">{deal.contacts.full_name}</p>
                    )}

                    {/* Valor */}
                    {deal.estimated_value && (
                      <p className="text-sm font-bold text-slate-700 mt-2.5">
                        ${Number(deal.estimated_value).toLocaleString()}
                      </p>
                    )}

                    {/* Próxima acción */}
                    {deal.next_action && (
                      <p className="text-xs text-slate-400 mt-1.5 leading-tight line-clamp-2">
                        → {deal.next_action}
                      </p>
                    )}

                    {/* Footer: score + owner */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                      {/* Score con barra visual */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              deal.score >= 60 ? 'bg-emerald-500' :
                              deal.score >= 30 ? 'bg-yellow-500' : 'bg-slate-300'
                            }`}
                            style={{ width: `${Math.min(deal.score ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${
                          deal.score >= 60 ? 'text-emerald-600' :
                          deal.score >= 30 ? 'text-yellow-600' : 'text-slate-400'
                        }`}>
                          {deal.score ?? 0}
                        </span>
                      </div>

                      {/* Owner inicial */}
                      {deal.profiles?.full_name && (
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-indigo-600">
                            {deal.profiles.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
