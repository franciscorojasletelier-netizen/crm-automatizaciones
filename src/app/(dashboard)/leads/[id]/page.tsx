import { getCurrentProfile } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, FileText, Eye, MessageCircle } from 'lucide-react'
import DealStageSelector from '@/components/deals/deal-stage-selector'
import DealInteractions from '@/components/deals/deal-interactions'
import DealTasks from '@/components/deals/deal-tasks'
import DeleteDealButton from '@/components/deals/delete-deal-button'
import DealEditFields from '@/components/deals/deal-edit-fields'
import DynamicFields from '@/components/fields/dynamic-fields'
import { getFieldDefinitions, formatFieldValue } from '@/lib/fields'
import ContactEdit from '@/components/deals/contact-edit'
import DealMembers from '@/components/deals/deal-members'
import DealChat from '@/components/chat/deal-chat'
import { canSeeDeal } from '@/lib/visibility'
import { canEditSection } from '@/lib/roles'
import DealSpecBanner from '@/components/deals/deal-spec-banner'
import DealOwnerSelector from '@/components/deals/deal-owner-selector'
import WhatsAppChat from '@/components/whatsapp/whatsapp-chat'
import DealAiInsights from '@/components/deals/deal-ai-insights'
import DealTimeline, { type TimelineSources } from '@/components/deals/deal-timeline'
import QuotesPanel from '@/components/deals/quotes-panel'
import EmailThread from '@/components/deals/email-thread'
import { formatCLP } from '@/lib/format'
import { getAllStages, stageByKey, stageLabel, colorOf } from '@/lib/stages'
import { CHILE_TZ, DATE_ONLY_TZ, chileDateString } from '@/lib/dates'
import DealInvoicesPanel from '@/components/cobranza/deal-invoices-panel'
import { INVOICE_SELECT, type Invoice } from '@/lib/cobranza'
import { canAccessSection } from '@/lib/roles'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, role, profile, sectionAccess, organizationId, supabase } = await getCurrentProfile()
  // getAllStages y no getStages: el historial puede referenciar etapas
  // que ya se desactivaron, y hay que poder mostrar su nombre igual.
  const stages = await getAllStages(supabase, organizationId ?? undefined)
  const { data: org } = organizationId
    ? await supabase.from('organizations').select('name, display_name, default_country_code, phone').eq('id', organizationId).maybeSingle()
    : { data: null }
  const orgDisplayName = org?.display_name || org?.name || 'nuestra empresa'
  const orgCountryCode = org?.default_country_code || '56'
  const dealFields = await getFieldDefinitions(supabase, 'deal', organizationId ?? undefined)
  const contactFields = await getFieldDefinitions(supabase, 'contact', organizationId ?? undefined)
  const companyFields = await getFieldDefinitions(supabase, 'company', organizationId ?? undefined)
  const userId = user.id
  const userName = profile?.full_name ?? profile?.email ?? 'Usuario'

  // Verificar acceso a este deal específico
  const hasAccess = await canSeeDeal(supabase, userId, role, id)
  if (!hasAccess) {
    redirect(`/acceso-denegado?from=/leads/${id}&role=${role}`)
  }

  const canSeePhone = ['super_admin', 'admin', 'gerente', 'comercial'].includes(role)

  // Si el rol no puede ver teléfonos, excluirlo de la query para que no llegue al cliente
  const contactSelect = canSeePhone ? '*' : 'id, full_name, email, job_title, custom_fields'

  const { data: deal } = await supabase
    .from('deals')
    .select(`*, companies(*), contacts:primary_contact_id(${contactSelect}), profiles:owner_id(id, full_name)`)
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const canManage = ['super_admin', 'gerente'].includes(role) && canEditSection(role, sectionAccess, 'leads')
  const canEdit   = ['super_admin', 'gerente', 'comercial'].includes(role) && canEditSection(role, sectionAccess, 'leads')
  const canDelete = ['super_admin'].includes(role) && canEditSection(role, sectionAccess, 'leads')

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
    specRequesterName = reqProfile?.full_name ?? null
  }

  const seesCobranza = canAccessSection(role, sectionAccess, 'cobranza')
  const [{ data: history }, { data: interactions }, { data: tasks }, { data: members }, { data: teamUsers }, { data: chatMessages }, { data: aiInsights }, { data: quotes }, { data: emails }, { data: connectedAccount }, { data: dealInvoices }] = await Promise.all([
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
    supabase.from('deal_ai_insights')
      .select('insights, created_at, profiles:created_by(full_name)')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('quotes').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
    supabase.from('email_messages').select('*').eq('deal_id', id).order('sent_at', { ascending: false }),
    supabase.from('email_accounts').select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
    seesCobranza
      ? supabase.from('invoices').select(INVOICE_SELECT).eq('deal_id', id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const acceptedQuote = ((quotes ?? []) as { id: string; quote_number: number; status: string; items: { description: string; quantity: number; unit_price: number }[]; tax_rate: number }[])
    .find(q => q.status === 'accepted') ?? null

  // profiles:created_by es a-uno; sin tipos de base se infiere como arreglo.
  const lastInsight = (aiInsights?.[0] ?? null) as unknown as {
    insights: React.ComponentProps<typeof DealAiInsights>['initialInsights']
    created_at: string
    profiles: { full_name: string | null } | null
  } | null

  const score = deal.score ?? 0

  const stage = stageByKey(stages, deal.stage)
  const whatsappHref = canSeePhone && deal.contacts?.phone ? (() => {
    const phone = deal.contacts.phone.replace(/\D/g, '')
    const intlPhone = phone.startsWith(orgCountryCode) ? phone : `${orgCountryCode}${phone}`
    const nombre = deal.contacts.full_name?.split(' ')[0] ?? 'te'
    const empresa = deal.companies?.name ?? 'tu empresa'
    const msg = encodeURIComponent(`Hola ${nombre}, te contacto de ${orgDisplayName}. Vi que ${empresa} puede beneficiarse de nuestros servicios. ¿Tienes unos minutos para conversar?`)
    return `https://wa.me/${intlPhone}?text=${msg}`
  })() : null

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-7 space-y-4">
        {/* Encabezado */}
        <div>
          <Link href="/leads" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Leads
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900">{deal.companies?.name ?? 'Sin empresa'}</h1>
                <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium ${colorOf(stage).chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colorOf(stage).dot}`} aria-hidden />
                  {stageLabel(stages, deal.stage)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {deal.contacts?.full_name && <span className="text-slate-700">{deal.contacts.full_name}</span>}
                {deal.contacts?.full_name && deal.contacts?.email && <span className="mx-1.5 text-slate-300" aria-hidden>·</span>}
                {deal.contacts?.email && <a href={`mailto:${deal.contacts.email}`} className="hover:text-accent-700 hover:underline">{deal.contacts.email}</a>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-800 text-[13px] font-medium shadow-xs hover:bg-slate-50">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                </a>
              )}
              {canDelete && <DeleteDealButton dealId={deal.id} />}
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg shadow-xs overflow-hidden [&>*]:bg-card">
          <div className="px-4 py-3.5">
            <p className="text-[13px] text-slate-500">Valor estimado</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] tabular-nums text-slate-900">{formatCLP(deal.estimated_value)}</p>
            {deal.source && <p className="mt-0.5 text-xs text-slate-500">Fuente: {deal.source}</p>}
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] text-slate-500">Probabilidad</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] tabular-nums text-slate-900">
              {deal.probability ? `${deal.probability}%` : stage?.defaultProbability ? `${stage.defaultProbability}%` : '—'}
            </p>
            {!deal.probability && stage?.defaultProbability ? <p className="mt-0.5 text-xs text-slate-500">Por defecto de la etapa</p> : null}
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] text-slate-500">Score</p>
            <p className={`mt-1 text-xl font-semibold tracking-[-0.02em] tabular-nums ${score >= 60 ? 'text-emerald-700' : score >= 30 ? 'text-amber-700' : 'text-slate-900'}`}>{score}</p>
            <p className="mt-0.5 text-xs text-slate-500">{score >= 60 ? 'Alto' : score >= 30 ? 'Medio' : 'Bajo'}</p>
          </div>
          <div className="px-4 py-3.5">
            <DealOwnerSelector
              dealId={deal.id}
              currentOwner={deal.profiles ? { id: deal.profiles.id, full_name: deal.profiles.full_name } : null}
              teamUsers={teamUsers ?? []}
              canReassign={canManage}
            />
          </div>
        </div>

        {/* Propuesta adjunta */}
        {deal.proposal_filename && (
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg shadow-xs px-4 py-3">
            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-slate-900 truncate">
                <span className="text-slate-500">Propuesta: </span>{deal.proposal_filename}
              </p>
              {deal.proposal_uploaded_at && (
                <p className="text-xs text-slate-500">
                  Subida el {new Date(deal.proposal_uploaded_at).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            {deal.proposal_url && (
              <a href={`/api/propuestas?deal=${deal.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-800 text-[13px] font-medium hover:bg-slate-50 shrink-0">
                <Eye className="w-3.5 h-3.5" /> Ver
              </a>
            )}
          </div>
        )}

        {/* Banner: proyecto pendiente de especificaciones */}
        {linkedProject && (
          <DealSpecBanner
            projectId={linkedProject.id}
            projectName={linkedProject.name}
            specNotes={linkedProject.spec_notes ?? null}
            specRequestedAt={linkedProject.spec_requested_at ?? null}
            specRequestedByName={specRequesterName}
            currentUserId={userId}
            canResolve={canEdit}
          />
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna izquierda */}
          <div className="lg:col-span-1 space-y-4">
            {/* Análisis IA */}
            <DealAiInsights
              dealId={deal.id}
              initialInsights={lastInsight?.insights ?? null}
              initialCreatedAt={lastInsight?.created_at ?? null}
              initialCreatedByName={lastInsight?.profiles?.full_name ?? null}
            />

            {/* Detalles editables */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Detalles</h2>
              {canEdit
                ? <DealEditFields deal={deal} />
                : (
                  <div className="space-y-2 divide-y divide-slate-100">
                    {[
                      { label: 'Valor estimado', value: formatCLP(deal.estimated_value) },
                      { label: 'Probabilidad',   value: deal.probability ? `${deal.probability}%` : '—' },
                      { label: 'Próxima acción', value: deal.next_action ?? '—' },
                      { label: 'Fuente',         value: deal.source ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="py-1">
                        <p className="text-xs font-medium text-slate-500">{label}</p>
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
                    {new Date(deal.expected_close_date).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ })}
                  </p>
                </div>
              )}
            </div>

            {/* Campos personalizados de esta organización */}
            {dealFields.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Campos adicionales</h2>
                {canEdit ? (
                  <DynamicFields entity="deal" entityId={deal.id} fields={dealFields} values={deal.custom_fields ?? {}} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dealFields.map(f => (
                      <div key={f.id} className="py-1">
                        <p className="text-xs font-medium text-slate-500">{f.label}</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                          {formatFieldValue(f, (deal.custom_fields ?? {})[f.key]) || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ContactEdit contact={deal.contacts} company={deal.companies} canSeePhone={canSeePhone} contactFields={contactFields} companyFields={companyFields} />

            {/* Gestión de equipo — visible para todos, editable solo para gerente */}
            <DealMembers
              dealId={deal.id}
              ownerId={deal.owner_id}
              members={(members ?? []) as unknown as React.ComponentProps<typeof DealMembers>['members']}
              teamUsers={(teamUsers ?? []) as React.ComponentProps<typeof DealMembers>['teamUsers']}
              currentUserId={userId}
              canManage={canManage}
            />

            {/* Timeline unificado: etapas + interacciones + tareas + chat en un solo feed */}
            <DealTimeline
              stages={stages}
              history={history ?? []}
              interactions={interactions ?? []}
              tasks={tasks ?? []}
              chatMessages={(chatMessages ?? []) as unknown as TimelineSources['chatMessages']}
              emails={emails ?? []}
            />
          </div>

          {/* Columna derecha */}
          <div className="lg:col-span-2 space-y-4">
            {canEdit && (
            <DealStageSelector
              stages={stages.filter(s => s.isActive && s.pipelineId === deal.pipeline_id)}
              dealId={deal.id}
              currentStage={deal.stage}
              proposalFilename={deal.proposal_filename ?? null}
              proposalUrl={deal.proposal_url ?? null}
              organizationId={organizationId ?? ''}
              companyName={deal.companies?.name ?? null}
              estimatedValue={deal.estimated_value ?? null}
            />
          )}
            <QuotesPanel dealId={deal.id} quotes={(quotes ?? []) as React.ComponentProps<typeof QuotesPanel>['quotes']} canEdit={canEdit} />
            {seesCobranza && (
              <DealInvoicesPanel
                invoices={(dealInvoices ?? []) as unknown as Invoice[]}
                today={chileDateString()}
                canCreate={canManage && (deal.status === 'won' || !!acceptedQuote)}
                companyId={deal.company_id ?? null}
                companyName={deal.companies?.name ?? null}
                dealId={deal.id}
                estimatedValue={deal.estimated_value ?? null}
                acceptedQuote={acceptedQuote}
              />
            )}
            <EmailThread
              dealId={deal.id}
              contactId={deal.contacts?.id ?? null}
              contactEmail={deal.contacts?.email ?? null}
              hasConnectedAccount={!!connectedAccount}
              emails={(emails ?? []) as React.ComponentProps<typeof EmailThread>['emails']}
            />
            <DealInteractions dealId={deal.id} interactions={interactions ?? []} />
            <DealTasks dealId={deal.id} tasks={tasks ?? []} />
            <DealChat
              dealId={deal.id}
              currentUserId={userId}
              currentUserName={userName}
              initialMessages={(chatMessages ?? []) as unknown as React.ComponentProps<typeof DealChat>['initialMessages']}
            />
          </div>
        </div>
      </div>

      {/* Chat WhatsApp flotante — visible para todos, envío solo para comerciales+ */}
      <WhatsAppChat
        dealId={deal.id}
        contactName={deal.contacts?.full_name ?? 'Cliente'}
        contactPhone={canSeePhone ? (deal.contacts?.phone ?? null) : null}
        canSend={canEdit}
        orgPhone={org?.phone ?? null}
      />
    </div>
  )
}
