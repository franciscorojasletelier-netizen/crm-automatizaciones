import { createClient, getCurrentProfile } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Calendar, TrendingUp, User, FileText, Eye, MessageCircle } from 'lucide-react'
import DealStageSelector from '@/components/deals/deal-stage-selector'
import DealInteractions from '@/components/deals/deal-interactions'
import DealTasks from '@/components/deals/deal-tasks'
import DeleteDealButton from '@/components/deals/delete-deal-button'
import DealEditFields from '@/components/deals/deal-edit-fields'
import ContactEdit from '@/components/deals/contact-edit'
import DealMembers from '@/components/deals/deal-members'
import DealChat from '@/components/chat/deal-chat'
import { canSeeDeal } from '@/lib/visibility'
import DealSpecBanner from '@/components/deals/deal-spec-banner'
import DealOwnerSelector from '@/components/deals/deal-owner-selector'

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
  const { user, role, profile, supabase } = await getCurrentProfile()
  const userId = user.id
  const userName = profile?.full_name ?? profile?.email ?? 'Usuario'

  // Verificar acceso a este deal específico
  const hasAccess = await canSeeDeal(supabase, userId, role, id)
  if (!hasAccess) {
    redirect(`/acceso-denegado?from=/leads/${id}&role=${role}`)
  }

  const { data: deal } = await supabase
    .from('deals')
    .select(`*, companies(*), contacts:primary_contact_id(*), profiles:owner_id(id, full_name)`)
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const canManage = ['super_admin', 'gerente'].includes(role)
  const canEdit   = ['super_admin', 'gerente', 'comercial'].includes(role)
  const canDelete = ['super_admin'].includes(role)

  // Buscar proyecto vinculado al deal con specs pendientes
  const { data: linkedProjects } = await supabase
    .from('projects')
    .select('id, name, status, spec_notes, spec_requested_at, spec_requested_by')
    .eq('deal_id', id)
    .eq('status', 'pendiente_especificaciones')
    .limit(1)
  const linkedProject = linkedProjects?.[0] ?? null

  // Si hay proyecto pendiente, obtener nombre del solicitante
  let specRequesterName: string | null = null
  if (linkedProject?.spec_requested_by) {
    const { data: reqProfile } = await supabase
      .from('profiles').select('full_name').eq('id', linkedProject.spec_requested_by).single()
    specRequesterName = (reqProfile as any)?.full_name ?? null
  }

  const [{ data: history }, { data: interactions }, { data: tasks }, { data: members }, { data: teamUsers }, { data: chatMessages }] = await Promise.all([
    supabase.from('pipeline_stage_history').select('*, profiles:changed_by(full_name)').eq('deal_id', id).order('changed_at', { ascending: false }),
    supabase.from('interactions').select('*, profiles:user_id(full_name)').eq('deal_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*, profiles:assigned_to(full_name)').eq('deal_id', id).order('is_completed', { ascending: true }).order('due_date', { ascending: true }),
    supabase.from('deal_members').select('id, user_id, profiles:user_id(full_name, email, role)').eq('deal_id', id),
    canManage
      ? supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true).in('role', ['super_admin', 'admin', 'gerente', 'comercial', 'produccion', 'soporte'])
      : Promise.resolve({ data: [] }),
    supabase.from('team_messages')
      .select('id, content, user_id, created_at, profiles:user_id(full_name, email)')
      .eq('deal_id', id)
      .order('created_at', { ascending: true })
      .limit(100),
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
          {canDelete && (
            <DeleteDealButton dealId={deal.id} companyId={deal.company_id} contactId={deal.primary_contact_id} />
          )}
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
                {deal.contacts?.phone && (() => {
                  const phone = deal.contacts.phone.replace(/\D/g, '')
                  const intlPhone = phone.startsWith('56') ? phone : `56${phone}`
                  const nombre = deal.contacts.full_name?.split(' ')[0] ?? 'te'
                  const empresa = deal.companies?.name ?? 'tu empresa'
                  const msg = encodeURIComponent(`Hola ${nombre}, te contacto de Autopilot SpA. Vi que ${empresa} puede beneficiarse de automatizar sus procesos. ¿Tienes unos minutos para conversar?`)
                  return (
                    <a href={`https://wa.me/${intlPhone}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-200 transition-all">
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp · {deal.contacts.phone}
                    </a>
                  )
                })()}
              </div>
            </div>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
            {[
              { label: 'Valor estimado', value: deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : '—', icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Probabilidad',   value: deal.probability ? `${deal.probability}%` : '—',           icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Fuente',         value: deal.source ?? '—',                                         icon: User, color: 'text-amber-600 bg-amber-50' },
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
            {/* Responsable — con selector si es gerente/admin */}
            <DealOwnerSelector
              dealId={deal.id}
              currentOwner={deal.profiles ? { id: (deal.profiles as any).id, full_name: (deal.profiles as any).full_name } : null}
              teamUsers={teamUsers ?? []}
              canReassign={canManage}
            />
          </div>

          {/* Propuesta adjunta — visible si existe */}
          {deal.proposal_filename && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Propuesta adjunta</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{deal.proposal_filename}</p>
                {deal.proposal_uploaded_at && (
                  <p className="text-[10px] text-slate-400">
                    {new Date(deal.proposal_uploaded_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              {deal.proposal_url && (
                <a href={`/api/propuestas?deal=${deal.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl border border-orange-200 transition-all shrink-0">
                  <Eye className="w-3.5 h-3.5" /> Ver propuesta
                </a>
              )}
            </div>
          )}

        </div>

        {/* Banner: proyecto pendiente de especificaciones */}
        {linkedProject && (
          <DealSpecBanner
            projectId={linkedProject.id}
            projectName={linkedProject.name}
            specNotes={(linkedProject as any).spec_notes ?? null}
            specRequestedAt={(linkedProject as any).spec_requested_at ?? null}
            specRequestedByName={specRequesterName}
            currentUserId={userId}
            canResolve={canEdit}
          />
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna izquierda */}
          <div className="lg:col-span-1 space-y-4">
            {/* Detalles editables */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalles</h2>
              {canEdit
                ? <DealEditFields deal={deal} />
                : (
                  <div className="space-y-2 divide-y divide-slate-100">
                    {[
                      { label: 'Valor estimado', value: deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : '—' },
                      { label: 'Probabilidad',   value: deal.probability ? `${deal.probability}%` : '—' },
                      { label: 'Próxima acción', value: deal.next_action ?? '—' },
                      { label: 'Fuente',         value: deal.source ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="py-1">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                )
              }
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

            {/* Gestión de equipo — visible para todos, editable solo para gerente */}
            <DealMembers
              dealId={deal.id}
              ownerId={deal.owner_id}
              members={(members ?? []) as any}
              teamUsers={(teamUsers ?? []) as any}
              currentUserId={userId}
              canManage={canManage}
            />

            {/* Historial de etapas */}
            {history && history.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historial</h2>
                <div className="space-y-2.5">
                  {history.map((h: any) => (
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
            {canEdit && (
            <DealStageSelector
              dealId={deal.id}
              currentStage={deal.stage}
              proposalFilename={deal.proposal_filename ?? null}
              proposalUrl={deal.proposal_url ?? null}
            />
          )}
            <DealInteractions dealId={deal.id} interactions={interactions ?? []} />
            <DealTasks dealId={deal.id} tasks={tasks ?? []} />
            <DealChat
              dealId={deal.id}
              currentUserId={userId}
              currentUserName={userName}
              initialMessages={(chatMessages ?? []) as any}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
