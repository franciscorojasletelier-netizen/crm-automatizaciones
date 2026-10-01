export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phone, Mail, MessageCircle, Users, Handshake, StickyNote, ExternalLink, FileText } from 'lucide-react'
import { requirePermission } from '@/lib/supabase/server'
import { canAccessSection } from '@/lib/roles'
import { CHILE_TZ, DATE_ONLY_TZ, chileDateString } from '@/lib/dates'
import { clp, getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader, Panel, Stat, StatStrip, EmptyState, buttonClass } from '@/components/ui/page'
import InvoiceForm from '@/components/cobranza/invoice-form'
import { PaymentForm, ActivityForm, DeletePaymentButton, CancelInvoiceButton } from '@/components/cobranza/invoice-actions'
import SendCollection from '@/components/cobranza/send-collection'
import { loadCollectionContext } from '@/lib/cobranza-server'
import {
  INVOICE_SELECT, STATUS_META, DOCUMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL, ACTIVITY_LABEL,
  balanceOf, daysOverdue, effectiveStatus, invoiceCode, isOpen, daysBetween,
  type Invoice, type ActivityKind, type PaymentMethod,
} from '@/lib/cobranza'

const COLLECTION_MANAGERS = ['super_admin', 'gerente', 'finanzas']

const ACTIVITY_ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  llamada: Phone, email: Mail, whatsapp: MessageCircle, reunion: Users, compromiso: Handshake, nota: StickyNote,
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'short', year: 'numeric' })
const fmtStamp = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type Payment = { id: string; amount: number; paid_on: string; method: PaymentMethod; reference: string | null; created_at: string; author: { full_name: string | null } | null }
type Activity = { id: string; kind: ActivityKind; notes: string; promise_date: string | null; promise_amount: number | null; created_at: string; author: { full_name: string | null; email: string | null } | null }

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { role, canEdit, supabase, organizationId, sectionAccess, disabledModules, user } = await requirePermission('cobranza')
  const canManage = canEdit && COLLECTION_MANAGERS.includes(role)
  const today = chileDateString()

  const { data: raw } = await supabase.from('invoices').select(INVOICE_SELECT).eq('id', id).maybeSingle()
  if (!raw) notFound()
  const invoice = raw as unknown as Invoice

  const [paymentsRes, activitiesRes, contactRes, companiesRes, peopleRes, dealRes, collection] = await Promise.all([
    supabase.from('invoice_payments').select('id, amount, paid_on, method, reference, created_at, author:created_by(full_name)')
      .eq('invoice_id', id).order('paid_on', { ascending: false }),
    supabase.from('invoice_activities').select('id, kind, notes, promise_date, promise_amount, created_at, author:created_by(full_name, email)')
      .eq('invoice_id', id).order('created_at', { ascending: false }),
    supabase.from('contacts').select('full_name, email, phone').eq('company_id', invoice.company_id).limit(1).maybeSingle(),
    canManage ? supabase.from('companies').select('id, name').eq('organization_id', organizationId ?? '').order('name')
              : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    canManage ? supabase.from('profiles').select('id, full_name, email').eq('organization_id', organizationId ?? '').eq('is_active', true).order('full_name')
              : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    invoice.deal_id ? supabase.from('deals').select('id').eq('id', invoice.deal_id).maybeSingle() : Promise.resolve({ data: null }),
    // Estado de cuenta del cliente completo (todos sus documentos abiertos), para enviar el cobro.
    canEdit && isOpen(invoice) ? loadCollectionContext(supabase, invoice.company_id, user.id, organizationId ?? null) : Promise.resolve(null),
  ])

  const payments = (paymentsRes.data ?? []) as unknown as Payment[]
  const activities = (activitiesRes.data ?? []) as unknown as Activity[]
  const contact = contactRes.data as { full_name: string | null; email: string | null; phone: string | null } | null
  const status = effectiveStatus(invoice, today)
  const meta = STATUS_META[status]
  const balance = balanceOf(invoice)
  const late = daysOverdue(invoice, today)
  const until = daysBetween(today, invoice.due_date)
  const open = isOpen(invoice)
  // El deal se enlaza solo si el usuario puede verlo (finanzas no ve el pipeline).
  const dealVisible = !!dealRes.data && canAccessSection(role, sectionAccess, 'leads', disabledModules)
  const paidPct = Math.min(100, Math.round((Number(invoice.paid_amount) / Number(invoice.amount)) * 100))

  return (
    <PageContainer>
      <PageHeader
        back={{ href: '/cobranza', label: 'Cobranza' }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {invoiceCode(invoice)} · {invoice.companies?.name ?? 'Cliente'}
            <span className={cn('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium align-middle', meta.chip)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} aria-hidden />{meta.label}
            </span>
          </span>
        }
        description={`${DOCUMENT_TYPE_LABEL[invoice.document_type]}${invoice.document_folio ? ` N° ${invoice.document_folio}` : ''} · ${invoice.description}`}
        actions={canManage && invoice.status !== 'anulada' && (
          <>
            <CancelInvoiceButton invoiceId={invoice.id} hasPayments={payments.length > 0} />
            <InvoiceForm invoice={invoice}
              companies={(companiesRes.data ?? []).map(c => ({ id: c.id, label: c.name }))}
              people={(peopleRes.data ?? []).map(p => ({ id: p.id, label: p.full_name ?? p.email ?? 'Usuario' }))} />
          </>
        )}
      />

      {invoice.status === 'anulada' && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Anulado el {invoice.cancelled_at ? fmtStamp(invoice.cancelled_at) : '—'}{invoice.cancelled_reason ? ` · ${invoice.cancelled_reason}` : ''}
        </div>
      )}

      <StatStrip>
        <Stat label="Monto" value={clp(invoice.amount)} context={`Emitido el ${fmtDay(invoice.issue_date)}`} />
        <Stat label="Pagado" value={clp(invoice.paid_amount)} tone={Number(invoice.paid_amount) > 0 ? 'success' : 'neutral'}
          context={`${paidPct}% · ${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}`} />
        <Stat label="Saldo" value={clp(balance)} tone={late > 0 ? 'danger' : balance > 0 ? 'neutral' : 'success'}
          context={balance === 0 && invoice.status === 'pagada' ? 'Documento pagado' : invoice.next_promise_date && open ? `Compromiso: ${fmtDay(invoice.next_promise_date)}` : 'Pendiente de pago'} />
        <Stat label="Vencimiento" value={fmtDay(invoice.due_date)} tone={late > 0 ? 'danger' : open && until <= 7 ? 'warning' : 'neutral'}
          context={!open ? '—' : late > 0 ? `${late} ${late === 1 ? 'día' : 'días'} de mora` : until === 0 ? 'Vence hoy' : `Faltan ${until} ${until === 1 ? 'día' : 'días'}`} />
      </StatStrip>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <Panel title="Pagos" description={payments.length ? `${clp(invoice.paid_amount)} recibidos` : 'Aún no hay pagos registrados'} padded={false}>
            {payments.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {payments.map(p => (
                  <li key={p.id} className="group flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 tabular-nums font-medium">{clp(p.amount)}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {fmtDay(p.paid_on)} · {PAYMENT_METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ''}
                        {p.author?.full_name ? ` · registró ${p.author.full_name}` : ''}
                      </p>
                    </div>
                    {canManage && <DeletePaymentButton paymentId={p.id} label={clp(p.amount)} />}
                  </li>
                ))}
              </ul>
            )}
            {canManage && open && (
              <div className={cn('px-4 py-4', payments.length > 0 && 'border-t border-slate-100 bg-slate-50/50')}>
                <PaymentForm key={`pay-${balance}`} invoiceId={invoice.id} balance={balance} />
              </div>
            )}
            {!canManage && payments.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">Finanzas registrará aquí los pagos.</p>}
          </Panel>

          <Panel title="Gestiones de cobranza" description="Llamadas, correos y compromisos de pago" padded={false}>
            {open && (
              <div className="px-4 py-4 border-b border-slate-100">
                <ActivityForm key={`act-${balance}`} invoiceId={invoice.id} balance={balance} />
              </div>
            )}
            {activities.length === 0 ? (
              <EmptyState title="Sin gestiones registradas" description={open ? 'Registra cada contacto con el cliente para que el equipo sepa en qué va el cobro.' : undefined} />
            ) : (
              <ol className="px-4 py-3 space-y-4">
                {activities.map(a => {
                  const Icon = ACTIVITY_ICON[a.kind]
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                        a.kind === 'compromiso' ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600')}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-slate-500">
                          <span className="font-medium text-slate-900">{ACTIVITY_LABEL[a.kind]}</span>
                          {' · '}{a.author?.full_name ?? a.author?.email ?? 'Usuario'} · {fmtStamp(a.created_at)}
                        </p>
                        {a.kind === 'compromiso' && a.promise_date && (
                          <p className="mt-1 text-[13px] font-medium text-accent-800">
                            Pagará {a.promise_amount ? clp(a.promise_amount) : 'el saldo'} el {fmtDay(a.promise_date)}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line break-words">{a.notes}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Cliente">
            <p className="text-sm font-medium text-slate-900">{invoice.companies?.name}</p>
            {contact ? (
              <div className="mt-3 flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center justify-center shrink-0">
                  {getInitials(contact.full_name, contact.email)}
                </span>
                <div className="min-w-0 text-[13px]">
                  <p className="text-slate-900">{contact.full_name}</p>
                  {contact.email && <a href={`mailto:${contact.email}`} className="block text-accent-700 hover:underline truncate">{contact.email}</a>}
                  {contact.phone && <a href={`tel:${contact.phone}`} className="block text-slate-600 hover:underline tabular-nums">{contact.phone}</a>}
                </div>
              </div>
            ) : <p className="mt-2 text-[13px] text-slate-500">Sin contacto registrado.</p>}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              {collection && collection.statement.lines.length > 0 && (
                <>
                  <p className="text-xs text-slate-500">
                    Deuda total del cliente: <span className="font-medium text-slate-900 tabular-nums">{clp(collection.statement.total)}</span>
                    {' '}en {collection.statement.lines.length} {collection.statement.lines.length === 1 ? 'documento' : 'documentos'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SendCollection
                      companyId={invoice.company_id} companyName={invoice.companies?.name ?? 'Cliente'}
                      contact={collection.contact} statement={collection.statement}
                      senderName={collection.senderName} orgName={collection.orgName} hasEmailAccount={collection.hasEmailAccount}
                      initialChannel="email" label="Correo" />
                    <SendCollection
                      companyId={invoice.company_id} companyName={invoice.companies?.name ?? 'Cliente'}
                      contact={collection.contact} statement={collection.statement}
                      senderName={collection.senderName} orgName={collection.orgName} hasEmailAccount={collection.hasEmailAccount}
                      initialChannel="whatsapp" variant="secondary" label="WhatsApp" />
                  </div>
                </>
              )}
              <Link href={`/cobranza/estado/${invoice.company_id}`} className={cn(buttonClass.secondary, 'w-full')}>
                <FileText className="w-3.5 h-3.5" /> Estado de cuenta
              </Link>
            </div>
          </Panel>

          <Panel title="Detalles">
            <dl className="space-y-2.5 text-[13px]">
              {[
                ['Documento', `${DOCUMENT_TYPE_LABEL[invoice.document_type]}${invoice.document_folio ? ` N° ${invoice.document_folio}` : ''}`],
                ['Emisión', fmtDay(invoice.issue_date)],
                ['Vencimiento', fmtDay(invoice.due_date)],
                ['Responsable', invoice.responsible?.full_name ?? 'Finanzas'],
                ['Última gestión', invoice.last_activity_at ? fmtStamp(invoice.last_activity_at) : 'Ninguna'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-slate-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {(dealVisible || invoice.project_id) && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                {dealVisible && (
                  <Link href={`/leads/${invoice.deal_id}`} className="flex items-center gap-1.5 text-[13px] text-accent-700 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Ver deal de origen
                  </Link>
                )}
                {invoice.project_id && (
                  <Link href={`/proyectos/${invoice.project_id}`} className="flex items-center gap-1.5 text-[13px] text-accent-700 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Ver proyecto
                  </Link>
                )}
              </div>
            )}
            {invoice.notes && (
              <p className="mt-3 pt-3 border-t border-slate-100 text-[13px] text-slate-600 whitespace-pre-line">{invoice.notes}</p>
            )}
          </Panel>
        </aside>
      </div>
    </PageContainer>
  )
}
