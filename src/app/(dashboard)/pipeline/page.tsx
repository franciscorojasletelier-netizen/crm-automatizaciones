export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'


const stages = [
  { key: 'nuevo_lead', label: 'Nuevo Lead', color: 'bg-blue-500' },
  { key: 'contactado', label: 'Contactado', color: 'bg-yellow-500' },
  { key: 'calificado', label: 'Calificado', color: 'bg-purple-500' },
  { key: 'reunion_agendada', label: 'Reunión Agendada', color: 'bg-indigo-500' },
  { key: 'reunion_realizada', label: 'Reunión Realizada', color: 'bg-cyan-500' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada', color: 'bg-orange-500' },
  { key: 'negociacion', label: 'Negociación', color: 'bg-pink-500' },
]

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
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

  const byStage = stages.reduce((acc, s) => {
    acc[s.key] = deals?.filter((d: any) => d.stage === s.key) ?? []
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">{deals?.length ?? 0} deals activos</p>
        </div>
        <Link href="/leads/nuevo"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo lead
        </Link>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {stages.map(stage => (
          <div key={stage.key} className="flex flex-col min-w-[220px] w-[220px]">
            {/* Header columna */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{stage.label}</span>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {byStage[stage.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {byStage[stage.key].length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                  <p className="text-xs text-gray-300">Sin deals</p>
                </div>
              )}
              {byStage[stage.key].map((deal: any) => (
                <Link key={deal.id} href={`/leads/${deal.id}`}
                  className="bg-white border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer block">
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {deal.companies?.name ?? 'Sin empresa'}
                  </p>
                  {deal.contacts?.full_name && (
                    <p className="text-xs text-gray-400 mt-0.5">{deal.contacts.full_name}</p>
                  )}
                  {deal.estimated_value && (
                    <p className="text-xs font-medium text-gray-600 mt-2">
                      ${Number(deal.estimated_value).toLocaleString()}
                    </p>
                  )}
                  {deal.next_action && (
                    <p className="text-xs text-gray-400 mt-1.5 leading-tight line-clamp-2">
                      → {deal.next_action}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-xs font-semibold ${deal.score >= 60 ? 'text-green-600' : deal.score >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      Score {deal.score}
                    </span>
                    {deal.profiles?.full_name && (
                      <span className="text-xs text-gray-400 truncate max-w-[80px]">
                        {deal.profiles.full_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

