export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canEditSection } from '@/lib/roles'
import { formatMoney } from '@/lib/format'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import ProjectPhaseSelector from '@/components/projects/project-phase-selector'
import ProjectDeliverables from '@/components/projects/project-deliverables'
import ProjectNotes from '@/components/projects/project-notes'
import ProjectSpecRequest from '@/components/projects/project-spec-request'
import { inferTriggerAt, triggerLabel } from '@/lib/payment-terms'
import { money } from '@/lib/money'
import { DATE_ONLY_TZ } from '@/lib/dates'

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery', diseno: 'Diseño de Flujos', desarrollo: 'Desarrollo',
  pruebas: 'Pruebas', entrega: 'Entrega', soporte: 'Soporte Post-lanzamiento',
}

const statusConfig: Record<string, { label: string; color: string }> = {
  activo:                     { label: 'Activo',                     color: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  pausado:                    { label: 'Pausado',                    color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  entregado:                  { label: 'Entregado',                  color: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  cancelado:                  { label: 'Cancelado',                  color: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
  pendiente_especificaciones: { label: 'Pend. especificaciones', color: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' },
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, role, supabase, sectionAccess, currency } = await getCurrentProfile()
  const canEditProyectos = canEditSection(role, sectionAccess, 'proyectos')

  // Query principal sin aliases complejos
  const { data: project } = await supabase
    .from('projects')
    .select('*, companies(name, industry), profiles:owner_id(full_name), deals(id, owner_id)')
    .eq('id', id)
    .single()

  if (!project) notFound()

  // Campos que usa la página (select('*') no infiere columnas; las relaciones son a-uno).
  const proj = project as {
    id: string; status: string; spec_requested_by: string | null; spec_notes: string | null; spec_requested_at: string | null
    companies: { name: string | null; industry: string | null } | null
    profiles: { full_name: string | null } | null
    deals: { id: string; owner_id: string | null } | null
  }

  // Query separada para quien solicitó las specs (evita el alias problemático)
  let specRequesterName: string | null = null
  if (proj.spec_requested_by) {
    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', proj.spec_requested_by)
      .single()
    specRequesterName = requester?.full_name ?? null
  }

  const [{ data: deliverables }, { data: notes }] = await Promise.all([
    supabase.from('project_deliverables').select('*').eq('project_id', id).order('created_at'),
    supabase.from('project_notes').select('*, profiles:user_id(full_name)').eq('project_id', id).order('created_at', { ascending: false }),
  ])

  const completedDeliverables = deliverables?.filter(d => d.is_completed).length ?? 0
  const totalDeliverables = deliverables?.length ?? 0
  const progress = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0

  // Plan de pagos de la cotización aceptada: qué cuota corresponde según el avance.
  const { data: accepted } = proj.deals?.id
    ? await supabase.from('quotes').select('id, quote_number, accepted_snapshot').eq('deal_id', proj.deals.id).eq('status', 'accepted')
      .not('accepted_snapshot', 'is', null).order('accepted_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  const { count: issuedCount } = accepted
    ? await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('quote_id', accepted.id).neq('status', 'anulada')
    : { count: 0 }
  const snapshot = accepted?.accepted_snapshot as { documento?: { moneda?: string }; plan_de_pagos?: { cuota: number; hito: string; porcentaje: number; monto: number; avance?: number | null }[] } | null
  const plan = snapshot?.plan_de_pagos ?? []
  const effectiveProgress = project.status === 'entregado' || project.delivered_at ? 100 : progress

  const statusInfo = statusConfig[proj.status] ?? { label: proj.status, color: 'bg-slate-100 text-slate-600' }
  const isPending = proj.status === 'pendiente_especificaciones'

  const canRequest = ['produccion', 'super_admin', 'gerente', 'admin'].includes(role) && canEditProyectos
  const canResolve = ['comercial', 'gerente', 'super_admin', 'admin'].includes(role) && canEditProyectos

  const dealOwnerId = proj.deals?.owner_id ?? null

  return (
    <div className="min-h-full bg-slate-50">

      {/* Top bar */}
      <div className={`sticky top-0 z-10 border-b px-4 md:px-6 py-3 flex items-center justify-between gap-4 ${
        isPending ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
      }`}>
        <Link href="/proyectos" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Proyectos
        </Link>
        <div className="flex items-center gap-2">
          {isPending && <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />}
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

        {/* Hero */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-start gap-4">
            <div className="bg-accent-600 w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
               >
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {proj.companies?.name && (
                  <span className="font-medium text-slate-600">{proj.companies.name}</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
            {[
              { label: 'Fase',         value: phaseLabels[project.phase] ?? project.phase, icon: Building2, color: 'text-accent-600 bg-accent-50' },
              { label: 'Presupuesto',  value: formatMoney(project.budget, currency), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Responsable',  value: proj.profiles?.full_name ?? '—', icon: User, color: 'text-accent-600 bg-accent-50' },
              { label: 'Fecha límite', value: project.due_date ? new Date(project.due_date).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ }) : '—', icon: Calendar, color: 'text-amber-600 bg-amber-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Barra de progreso */}
          {totalDeliverables > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">{completedDeliverables} de {totalDeliverables} entregables</span>
                <span className="font-bold text-slate-900">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: 'var(--color-accent-600)' }} />
              </div>
            </div>
          )}

          {/* Link al deal */}
          {proj.deals?.id && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Deal de origen</p>
              <Link href={`/leads/${proj.deals.id}`}
                className="text-xs font-semibold text-accent-600 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 px-3 py-1 rounded-lg transition-colors">
                Ver deal →
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna izquierda */}
          <div className="lg:col-span-1 space-y-4">

            {/* Detalles */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Detalles</h2>
              <div className="space-y-3 divide-y divide-slate-100">
                {[
                  { label: 'Horas estimadas', value: project.estimated_hours ? `${project.estimated_hours}h` : null },
                  { label: 'Horas reales',    value: project.actual_hours    ? `${project.actual_hours}h`    : null },
                  { label: 'Inicio',          value: project.start_date ? new Date(project.start_date).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ }) : null },
                ].filter(x => x.value).map(({ label, value }) => (
                  <div key={label} className="pt-2 first:pt-0">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Satisfacción */}
            {project.customer_satisfaction_score && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Satisfacción cliente</h2>
                <p className="text-2xl">
                  {'★'.repeat(project.customer_satisfaction_score)}
                  <span className="text-slate-200">{'★'.repeat(5 - project.customer_satisfaction_score)}</span>
                </p>
              </div>
            )}

            {/* Botón devolver a comercial */}
            <ProjectSpecRequest
              projectId={proj.id}
              dealId={proj.deals?.id ?? null}
              dealOwnerId={dealOwnerId}
              currentStatus={proj.status}
              specNotes={proj.spec_notes ?? null}
              specRequestedAt={proj.spec_requested_at ?? null}
              specRequestedByName={specRequesterName}
              currentUserId={user.id}
              canRequest={canRequest}
              canResolve={canResolve}
            />
          </div>

          {/* Columna derecha */}
          <div className="lg:col-span-2 space-y-4">
            <ProjectPhaseSelector
              projectId={project.id}
              currentPhase={project.phase}
              currentStatus={project.status}
              readOnly={!canEditProyectos}
            />
            {plan.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs">
                <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Plan de pagos · Cotización N° {accepted!.quote_number}</h2>
                  <span className="text-xs text-slate-500">Avance {effectiveProgress}%</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {plan.map((c, i) => {
                    const at = c.avance ?? inferTriggerAt(c.hito, i)
                    const issued = (issuedCount ?? 0) > i
                    const due = at != null && effectiveProgress >= at
                    return (
                      <li key={c.cuota} className="px-4 py-2.5 flex items-center gap-3 text-[13px]">
                        <span className="min-w-0 flex-1 text-slate-700">Cuota {c.cuota} · {c.hito} <span className="text-slate-400">({c.porcentaje} %, {triggerLabel(at)})</span></span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${issued ? 'bg-emerald-100 text-emerald-700' : due ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                          {issued ? 'Cobro creado' : due ? 'Corresponde facturar' : 'Pendiente'}
                        </span>
                        <span className="w-28 text-right tabular-nums font-medium text-slate-900">{money(c.monto, snapshot?.documento?.moneda ?? currency)}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="px-4 py-2.5 text-[11px] text-slate-500 border-t border-slate-100">Al llegar al avance de cada cuota se crea la tarea «Emitir factura» para el responsable del negocio.</p>
              </div>
            )}
            <ProjectDeliverables projectId={project.id} deliverables={deliverables ?? []} readOnly={!canEditProyectos} />
            <ProjectNotes projectId={project.id} notes={notes ?? []} readOnly={!canEditProyectos} />
          </div>
        </div>
      </div>
    </div>
  )
}
