export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requirePermission } from '@/lib/supabase/server'
import { chileDateString } from '@/lib/dates'
import { money, formatMoney } from '@/lib/format'
import { PageContainer, PageHeader, Stat, StatStrip, Panel, buttonClass } from '@/components/ui/page'
import { BellRing } from 'lucide-react'
import InvoicesTable from '@/components/cobranza/invoices-table'
import InvoiceForm, { type InvoicePrefill } from '@/components/cobranza/invoice-form'
import { INVOICE_SELECT, AGING_BUCKETS, monthStart, summarize, buildCollectionQueue, type Invoice } from '@/lib/cobranza'
import CollectionQueue from '@/components/cobranza/collection-queue'
import { loadContactsByCompany, loadSenderContext } from '@/lib/cobranza-server'
import { cn } from '@/lib/utils'

const COLLECTION_MANAGERS = ['super_admin', 'gerente', 'finanzas']

export default async function CobranzaPage({ searchParams }: {
  searchParams: Promise<{ nuevo?: string; empresa?: string; deal?: string; proyecto?: string; cotizacion?: string; monto?: string; concepto?: string; filtro?: string; cola?: string }>
}) {
  const params = await searchParams
  const { role, canEdit, supabase, organizationId, user, currency } = await requirePermission('cobranza')
  const canManage = canEdit && COLLECTION_MANAGERS.includes(role)
  const today = chileDateString()

  const [invoicesRes, paymentsRes, companiesRes, peopleRes] = await Promise.all([
    supabase.from('invoices').select(INVOICE_SELECT).order('due_date', { ascending: true }).limit(2000),
    supabase.from('invoice_payments').select('amount').gte('paid_on', monthStart(today)),
    canManage
      ? supabase.from('companies').select('id, name').eq('organization_id', organizationId ?? '').order('name').limit(2000)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    canManage
      ? supabase.from('profiles').select('id, full_name, email').eq('organization_id', organizationId ?? '').eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ])

  const invoices = (invoicesRes.data ?? []) as unknown as Invoice[]
  const summary = summarize(invoices, (paymentsRes.data ?? []) as { amount: number }[], today)
  const companies = (companiesRes.data ?? []).map(c => ({ id: c.id, label: c.name }))
  const people = (peopleRes.data ?? []).map(p => ({ id: p.id, label: p.full_name ?? p.email ?? 'Usuario' }))

  // Cola del día (solo quien puede gestionar): contactos y remitente en paralelo.
  const queue = canEdit ? buildCollectionQueue(invoices, today) : []
  const [queueContacts, sender] = canEdit
    ? await Promise.all([
        loadContactsByCompany(supabase, queue.map(q => q.companyId)),
        loadSenderContext(supabase, user.id, organizationId ?? null),
      ])
    : [new Map(), null]

  // Viene de "Crear cobro" en un deal, proyecto o cotización.
  const prefill: InvoicePrefill = {
    company_id: params.empresa, deal_id: params.deal, project_id: params.proyecto, quote_id: params.cotizacion,
    description: params.concepto, amount: params.monto ? Number(params.monto) : undefined,
  }
  const agingTotal = summary.receivable || 1

  return (
    <PageContainer>
      <PageHeader
        title="Cobranza"
        description={summary.openCount > 0
          ? `${summary.openCount} ${summary.openCount === 1 ? 'documento abierto' : 'documentos abiertos'} · ${summary.overdueCount} ${summary.overdueCount === 1 ? 'vencido' : 'vencidos'}`
          : 'Documentos por cobrar, pagos y gestiones de cobranza'}
        actions={canManage && (
          <>
            <Link href="/cobranza/recordatorios" className={buttonClass.secondary}>
              <BellRing className="w-3.5 h-3.5" /> Recordatorios
            </Link>
            <InvoiceForm companies={companies} people={people} prefill={prefill} openInitially={params.nuevo === '1'} />
          </>
        )}
      />

      <StatStrip>
        <Stat label="Por cobrar" value={money(summary.receivable, currency)}
          context={`${summary.openCount} ${summary.openCount === 1 ? 'documento' : 'documentos'}`} />
        <Stat label="Vencido" tone={summary.overdue > 0 ? 'danger' : 'neutral'}
          value={money(summary.overdue, currency)}
          context={summary.overdue > 0
            ? `${summary.overdueCount} docs · mora prom. ${summary.weightedDaysOverdue} días`
            : 'Sin mora'} />
        <Stat label="Vence en 7 días" tone={summary.dueSoon > 0 ? 'warning' : 'neutral'}
          value={money(summary.dueSoon, currency)}
          context={`${summary.dueSoonCount} ${summary.dueSoonCount === 1 ? 'documento' : 'documentos'}`} />
        <Stat label="Cobrado este mes" tone={summary.collectedThisMonth > 0 ? 'success' : 'neutral'}
          value={money(summary.collectedThisMonth, currency)}
          context="Pagos registrados desde el día 1" />
      </StatStrip>

      {canEdit && sender && (
        <div className="mt-4">
          <CollectionQueue queue={queue} invoices={invoices} today={today} contacts={queueContacts}
            sender={{ senderName: sender.senderName, orgName: sender.orgName, canSendEmail: sender.canSendEmail, emailFrom: sender.emailFrom, emailOrg: sender.emailOrg }}
            showAll={params.cola === 'todos'} />
        </div>
      )}

      {summary.receivable > 0 && (
        <Panel className="mt-4" title="Antigüedad de la deuda" description="Saldo por cobrar según días de mora">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100" role="img"
            aria-label={AGING_BUCKETS.map(b => `${b.label}: ${formatMoney(summary.aging[b.key].amount, currency)}`).join(', ')}>
            {AGING_BUCKETS.map(b => {
              const pct = (summary.aging[b.key].amount / agingTotal) * 100
              return pct > 0 ? <div key={b.key} className={b.bar} style={{ width: `${pct}%` }} /> : null
            })}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-y-3 sm:grid-cols-5">
            {AGING_BUCKETS.map(b => {
              const bucket = summary.aging[b.key]
              return (
                <div key={b.key} className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={cn('w-2 h-2 rounded-sm', b.bar)} aria-hidden /> {b.label}
                  </dt>
                  <dd className={cn('mt-0.5 text-sm font-semibold tabular-nums', bucket.amount > 0 ? (b.key === 'al_dia' ? 'text-slate-900' : b.text) : 'text-slate-400')}>
                    {money(bucket.amount, currency)}
                  </dd>
                  <dd className="text-xs text-slate-500 tabular-nums">{bucket.count} {bucket.count === 1 ? 'doc.' : 'docs.'}</dd>
                </div>
              )
            })}
          </dl>
        </Panel>
      )}

      <div className="mt-4">
        <InvoicesTable invoices={invoices} today={today} canManage={canManage}
          initialFilter={params.filtro === 'vencidos' ? 'vencidos' : 'abiertos'} />
      </div>

      {!canManage && (
        <p className="mt-3 text-xs text-slate-500">
          Ves los documentos de tus deals. Para registrar pagos o crear documentos, contacta a finanzas.{' '}
          <Link href="/notificaciones" className="underline hover:text-slate-800">Ver avisos</Link>
        </p>
      )}
    </PageContainer>
  )
}
