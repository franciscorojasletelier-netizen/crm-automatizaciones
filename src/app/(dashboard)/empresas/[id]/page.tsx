export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, Mail, Phone, Globe, FileText, FolderOpen, Wallet, TrendingUp, ExternalLink } from 'lucide-react'
import { requirePermission } from '@/lib/supabase/server'
import { canAccessSection } from '@/lib/roles'
import { getAllStages, stageByKey, colorOf } from '@/lib/stages'
import { money, formatMoney } from '@/lib/money'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { INVOICE_SELECT, STATUS_META, balanceOf, effectiveStatus, invoiceCode, daysOverdue, type Invoice } from '@/lib/cobranza'
import { chileDateString, CHILE_TZ } from '@/lib/dates'
import { PageContainer, PageHeader, Panel, Stat, StatStrip, EmptyState, buttonClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'

const QUOTE_STATUS: Record<string, { label: string; chip: string }> = {
  draft:    { label: 'Borrador',  chip: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Enviada',   chip: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Aceptada',  chip: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', chip: 'bg-red-100 text-red-700' },
  expired:  { label: 'Vencida',   chip: 'bg-amber-100 text-amber-700' },
}
const PROJECT_STATUS: Record<string, string> = {
  activo: 'Activo', pendiente_especificaciones: 'Pendiente de especificaciones', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado',
}
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short', year: 'numeric' })

// Ficha de un cliente: todo lo que hay con él en un solo lugar (negocios,
// cotizaciones, proyectos y cobranza). La RLS acota lo que cada rol ve.
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, canEdit, organizationId, role, sectionAccess, disabledModules, currency } = await requirePermission('empresas')

  const { data: company } = await supabase.from('companies')
    .select('id, name, industry, website, country, employee_count, is_existing_client, created_at, contacts(id, full_name, email, phone, job_title)')
    .eq('id', id).maybeSingle()
  if (!company) notFound()

  const seesCobranza = canAccessSection(role, sectionAccess, 'cobranza', disabledModules)
  const seesProjects = canAccessSection(role, sectionAccess, 'proyectos', disabledModules)
  const [{ data: deals }, stages, { data: projects }, { data: invoices }] = await Promise.all([
    supabase.from('deals').select('id, stage, status, estimated_value, updated_at, profiles:owner_id(full_name)')
      .eq('company_id', id).is('deleted_at', null).order('updated_at', { ascending: false }),
    getAllStages(supabase, organizationId ?? undefined),
    seesProjects
      ? supabase.from('projects').select('id, name, status, phase, budget, start_date').eq('company_id', id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    seesCobranza
      ? supabase.from('invoices').select(INVOICE_SELECT).eq('company_id', id).order('due_date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const dealIds = (deals ?? []).map(d => d.id)
  const { data: quotes } = dealIds.length
    ? await supabase.from('quotes').select('id, deal_id, quote_number, status, items, taxes, tax_rate, currency, created_at')
      .in('deal_id', dealIds).order('created_at', { ascending: false })
    : { data: [] }

  const contacts = (company.contacts ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null; job_title: string | null }[]
  const openDeals = (deals ?? []).filter(d => d.status === 'open')
  const wonValue = (deals ?? []).filter(d => d.status === 'won').reduce((s, d) => s + Number(d.estimated_value ?? 0), 0)
  const invs = (invoices ?? []) as unknown as Invoice[]
  const today = chileDateString()
  const receivable = invs.reduce((s, i) => s + balanceOf(i), 0)
  const overdue = invs.filter(i => daysOverdue(i, today) > 0).reduce((s, i) => s + balanceOf(i), 0)

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        back={{ href: '/empresas', label: 'Empresas' }}
        title={company.name}
        description={[company.industry, company.country, company.is_existing_client ? 'Cliente' : 'Prospecto'].filter(Boolean).join(' · ')}
        actions={<>
          {seesCobranza && invs.length > 0 && (
            <Link href={`/cobranza/estado/${company.id}`} className={buttonClass.secondary}><Wallet className="w-4 h-4" /> Estado de cuenta</Link>
          )}
          {canEdit && (
            <Link href={`/leads/nuevo?empresa=${company.id}`} className={buttonClass.primary}><Plus className="w-4 h-4" /> Nuevo negocio</Link>
          )}
        </>}
      />

      <StatStrip>
        <Stat label="Negocios abiertos" value={String(openDeals.length)} context={`${(deals ?? []).length} en total`} />
        <Stat label="Ganado" value={money(wonValue, currency)} tone={wonValue > 0 ? 'success' : 'neutral'} />
        {seesCobranza && <Stat label="Por cobrar" value={money(receivable, currency)} context={overdue > 0 ? `${money(overdue, currency)} vencido` : 'Al día'} tone={overdue > 0 ? 'danger' : 'neutral'} />}
        {seesProjects && <Stat label="Proyectos" value={String((projects ?? []).length)} />}
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <Panel title="Negocios" padded={false}>
            {(deals ?? []).length === 0
              ? <div className="p-4"><EmptyState icon={TrendingUp} title="Sin negocios" description="Crea el primero con «Nuevo negocio»." /></div>
              : (
                <ul className="divide-y divide-slate-100">
                  {(deals ?? []).map(d => {
                    const st = stageByKey(stages, d.stage)
                    const c = colorOf(st)
                    const owner = (d.profiles as unknown as { full_name: string | null } | null)?.full_name
                    return (
                      <li key={d.id}>
                        <Link href={`/leads/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', c.light, c.text)}>{st?.label ?? d.stage}</span>
                          <span className="min-w-0 flex-1 text-[13px] text-slate-600 truncate">{owner ? `Responsable: ${owner}` : 'Sin responsable'} · {fmtDay(d.updated_at)}</span>
                          <span className="text-[13px] font-medium tabular-nums text-slate-900 whitespace-nowrap">{formatMoney(d.estimated_value, currency)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
          </Panel>

          <Panel title="Cotizaciones" padded={false}>
            {(quotes ?? []).length === 0
              ? <p className="p-4 text-[13px] text-slate-500 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Sin cotizaciones.</p>
              : (
                <ul className="divide-y divide-slate-100">
                  {(quotes ?? []).map(q => {
                    const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft
                    const total = quoteTotals(q.items as QuoteItem[] | null, quoteTaxes(q), q.currency).total
                    return (
                      <li key={q.id}>
                        <Link href={`/leads/${q.deal_id}/cotizacion/${q.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className="text-[13px] font-medium text-slate-900">Cotización N° {q.quote_number}</span>
                          <span className="text-[12px] text-slate-500">{fmtDay(q.created_at)}</span>
                          <span className={cn('ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full', st.chip)}>{st.label}</span>
                          <span className="w-28 text-right text-[13px] tabular-nums text-slate-900">{money(total, q.currency)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
          </Panel>

          {seesProjects && (
            <Panel title="Proyectos" padded={false}>
              {(projects ?? []).length === 0
                ? <p className="p-4 text-[13px] text-slate-500 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-slate-400" /> Sin proyectos (se crean al ganar un negocio).</p>
                : (
                  <ul className="divide-y divide-slate-100">
                    {(projects ?? []).map(p => (
                      <li key={p.id}>
                        <Link href={`/proyectos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-900 truncate">{p.name}</span>
                          <span className="text-[12px] text-slate-500 whitespace-nowrap">{PROJECT_STATUS[p.status] ?? p.status}</span>
                          <span className="w-28 text-right text-[13px] tabular-nums text-slate-900">{formatMoney(p.budget, currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          )}

          {seesCobranza && (
            <Panel title="Cobranza" padded={false}>
              {invs.length === 0
                ? <p className="p-4 text-[13px] text-slate-500 flex items-center gap-2"><Wallet className="w-4 h-4 text-slate-400" /> Sin documentos por cobrar.</p>
                : (
                  <ul className="divide-y divide-slate-100">
                    {invs.map(inv => {
                      const meta = STATUS_META[effectiveStatus(inv, today)]
                      return (
                        <li key={inv.id}>
                          <Link href={`/cobranza/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                            <span className="min-w-0 flex-1 text-[13px] text-slate-900 truncate">{invoiceCode(inv)} <span className="text-slate-500">· {inv.description}</span></span>
                            <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap', meta.chip)}>{meta.label}</span>
                            <span className="w-28 text-right text-[13px] tabular-nums text-slate-900">{money(balanceOf(inv), currency)}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Datos">
            <dl className="space-y-2 text-[13px]">
              {company.website && (
                <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-slate-400" />
                  <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline truncate inline-flex items-center gap-1">
                    {company.website.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {company.employee_count && <div className="text-slate-600">{company.employee_count} empleados</div>}
              <div className="text-slate-500">Registrada el {fmtDay(company.created_at)}</div>
            </dl>
          </Panel>
          <Panel title="Contactos" padded={false}>
            {contacts.length === 0
              ? <p className="p-4 text-[13px] text-slate-500">Sin contactos.</p>
              : (
                <ul className="divide-y divide-slate-100">
                  {contacts.map(c => (
                    <li key={c.id} className="px-4 py-3 text-[13px]">
                      <p className="font-medium text-slate-900">{c.full_name ?? 'Sin nombre'}</p>
                      {c.job_title && <p className="text-slate-500">{c.job_title}</p>}
                      {c.email && <a href={`mailto:${c.email}`} className="mt-1 flex items-center gap-1.5 text-accent-700 hover:underline break-all"><Mail className="w-3.5 h-3.5 shrink-0" /> {c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="mt-0.5 flex items-center gap-1.5 text-slate-600 hover:text-slate-900"><Phone className="w-3.5 h-3.5 shrink-0" /> {c.phone}</a>}
                    </li>
                  ))}
                </ul>
              )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  )
}
