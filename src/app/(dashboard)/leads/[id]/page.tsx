import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, Calendar, TrendingUp } from 'lucide-react'
import DealStageSelector from '@/components/deals/deal-stage-selector'
import DealInteractions from '@/components/deals/deal-interactions'
import DealTasks from '@/components/deals/deal-tasks'
import DeleteDealButton from '@/components/deals/delete-deal-button'
import DealEditFields from '@/components/deals/deal-edit-fields'
import ContactEdit from '@/components/deals/contact-edit'

const stageColors: Record<string, string> = {
  nuevo_lead:        'bg-blue-100   text-blue-700   ring-1 ring-blue-200',
  contactado:        'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  calificado:        'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  reunion_agendada:  'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
  reunion_realizada: 'bg-cyan-100   text-cyan-700   ring-1 ring-cyan-200',
  propuesta_enviada: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  negociacion:       'bg-pink-100   text-pink-700   ring-1 ring-pink-200',
  cerrado_ganado:    'bg-green-100  text-green-700  ring-1 ring-green-200',
  cerrado_perdido:   'bg-red-100    text-red-700    ring-1 ring-red-200',
  no_calificado:     'bg-gray-100   text-gray-600   ring-1 ring-gray-200',
  frio:              'bg-slate-100  text-slate-600  ring-1 ring-slate-200',
}

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead', contactado: 'Contactado', calificado: 'Calificado',
  reunion_agendada: 'Reunión Agendada', reunion_realizada: 'Reunión Realizada',
  propuesta_enviada: 'Propuesta Enviada', negociacion: 'Negociación',
  cerrado_ganado: 'Cerrado Ganado', cerrado_perdido: 'Cerrado Perdido',
  no_calificado: 'No Calificado', frio: 'Frío',
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select(`*, companies(*), contacts:primary_contact_id(*), profiles:owner_id(full_name)`)
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const [{ data: history }, { data: interactions }, { data: tasks }] = await Promise.all([
    supabase.from('pipeline_stage_history').select('*, profiles:changed_by(full_name)').eq('deal_id', id).order('changed_at', { ascending: false }),
    supabase.from('interactions').select('*, profiles:user_id(full_name)').eq('deal_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*, profiles:assigned_to(full_name)').eq('deal_id', id).order('is_completed', { ascending: true }).order('due_date', { ascending: true }),
  ])

  const score = deal.score ?? 0

  return (
    <div className="min-h-full bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Leads
        </Link>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
            {stageLabels[deal.stage]}
          </span>
          <DeleteDealButton dealId={deal.id} companyId={deal.company_id} contactId={deal.primary_contact_id} />
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Hero header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{deal.companies?.name ?? 'Sin empresa'}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {deal.contacts?.full_name && <span className="font-medium text-slate-600">{deal.contacts.full_name}</span>}
                  {deal.contacts?.full_name && deal.contacts?.email && <span className="mx-1.5 text-slate-300">·</span>}
                  {deal.contacts?.email && <span>{deal.contacts.email}</span>}
                </p>
              </div>
            </div>

            {/* Score badge */}
            <div className="shrink-0 text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
                score >= 60 ? 'bg-emerald-100 text-emerald-700' :
                score >= 30 ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {score}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Score</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
            {[
              { label: 'Valor estimado', value: deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : '—', icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Probabilidad', value: deal.probability ? `${deal.probability}%` : '—', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Fuente', value: deal.source ?? '—', icon: User, color: 'text-amber-600 bg-amber-50' },
              { label: 'Responsable', value: deal.profiles?.full_name ?? '—', icon: User, color: 'text-purple-600 bg-purple-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Columna izquierda */}
          <div className="lg:col-span-1 space-y-4">
            {/* Detalles editables */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalles</h2>
              <DealEditFields deal={deal} />
              {deal.expected_close_date && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">Cierre esperado</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(deal.expected_close_date).toLocaleDateString('es-CL')}
                  </p>
                </div>
              )}
            </div>

            <ContactEdit contact={deal.contacts} company={deal.companies} />

            {/* Historial de etapas */}
            {history && history.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historial</h2>
                <div className="space-y-2.5">
                  {history.map((h: any, i: number) => (
                    <div key={h.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-600 leading-tight">
                          <span className="font-semibold text-slate-400">{stageLabels[h.from_stage] ?? h.from_stage}</span>
                          <span className="mx-1 text-slate-300">→</span>
                          <span className="font-semibold text-slate-800">{stageLabels[h.to_stage] ?? h.to_stage}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(h.changed_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {h.profiles?.full_name && ` · ${h.profiles.full_name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div className="lg:col-span-2 space-y-4">
            <DealStageSelector dealId={deal.id} currentStage={deal.stage} />
            <DealInteractions dealId={deal.id} interactions={interactions ?? []} />
            <DealTasks dealId={deal.id} tasks={tasks ?? []} />
          </div>
        </div>
      </div>
    </div>
  )
}
