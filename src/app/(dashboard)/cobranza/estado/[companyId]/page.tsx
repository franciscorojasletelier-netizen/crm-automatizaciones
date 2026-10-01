export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/supabase/server'
import { DATE_ONLY_TZ, chileDateString } from '@/lib/dates'
import { clp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { loadCollectionContext } from '@/lib/cobranza-server'
import { EmptyState, buttonClass } from '@/components/ui/page'
import PrintButton from '@/components/cobranza/print-button'
import SendCollection from '@/components/cobranza/send-collection'
import { FileCheck2 } from 'lucide-react'

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'short', year: 'numeric' })

export default async function EstadoDeCuentaPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const { supabase, user, organizationId, canEdit } = await requirePermission('cobranza')
  const ctx = await loadCollectionContext(supabase, companyId, user.id, organizationId ?? null)
  if (!ctx.company) notFound()
  const { company, contact, statement, org, orgName } = ctx
  const today = chileDateString()
  const sendProps = {
    companyId: company.id, companyName: company.name, contact, statement,
    senderName: ctx.senderName, orgName, hasEmailAccount: ctx.hasEmailAccount,
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-5 md:px-8 md:py-7 print:max-w-none print:p-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/cobranza" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900">
          <span aria-hidden>←</span> Cobranza
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          {canEdit && statement.lines.length > 0 && (
            <>
              <SendCollection {...sendProps}
                initialChannel="whatsapp" variant="secondary" label="WhatsApp" />
              <SendCollection {...sendProps}
                initialChannel="email" label="Enviar por correo" />
            </>
          )}
        </div>
      </div>

      {/* Documento */}
      <article className="bg-white border border-slate-200 rounded-lg shadow-xs print:border-0 print:shadow-none print:rounded-none p-6 md:p-10 print:p-0 text-slate-900">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold">{orgName ?? 'Estado de cuenta'}</p>
            {org && (
              <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                {org.address && <p>{org.address}</p>}
                {(org.email || org.phone) && <p>{[org.email, org.phone].filter(Boolean).join(' · ')}</p>}
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <h1 className="text-xl font-semibold tracking-[-0.01em]">Estado de cuenta</h1>
            <p className="mt-1 text-xs text-slate-500">Al {fmtDay(today)}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 py-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="mt-0.5 text-sm font-medium">{company.name}</p>
            {contact?.full_name && <p className="text-[13px] text-slate-600">At. {contact.full_name}</p>}
            {contact?.email && <p className="text-[13px] text-slate-600">{contact.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:text-right">
            <div>
              <p className="text-xs text-slate-500">Total adeudado</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{clp(statement.total)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Vencido</p>
              <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', statement.overdue > 0 ? 'text-red-700' : 'text-slate-900')}>
                {clp(statement.overdue)}
              </p>
            </div>
          </div>
        </section>

        {statement.lines.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Sin deuda pendiente" description={`${company.name} no tiene documentos con saldo por pagar.`}
            action={<Link href="/cobranza" className={buttonClass.secondary}>Volver a Cobranza</Link>} />
        ) : (
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Documento</th>
                  <th className="py-2 pr-3 font-medium hidden sm:table-cell print:table-cell">Emisión</th>
                  <th className="py-2 pr-3 font-medium">Vencimiento</th>
                  <th className="py-2 pr-3 font-medium text-right hidden sm:table-cell print:table-cell">Monto</th>
                  <th className="py-2 pr-3 font-medium text-right hidden sm:table-cell print:table-cell">Abonado</th>
                  <th className="py-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.lines.map(l => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{l.document}</p>
                      <p className="text-xs text-slate-500">{l.description}</p>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap hidden sm:table-cell print:table-cell">{fmtDay(l.issueDate)}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {fmtDay(l.dueDate)}
                      {l.daysLate > 0 && <p className="text-xs text-red-700">{l.daysLate} {l.daysLate === 1 ? 'día' : 'días'} de atraso</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums hidden sm:table-cell print:table-cell">{clp(l.amount)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums hidden sm:table-cell print:table-cell">{l.paid > 0 ? clp(l.paid) : '—'}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{clp(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300">
                  <td className="pt-3 font-semibold" colSpan={1}>Total adeudado</td>
                  <td className="hidden sm:table-cell print:table-cell" colSpan={4} />
                  <td className="sm:hidden print:hidden" />
                  <td className="pt-3 text-right tabular-nums font-semibold">{clp(statement.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500 leading-relaxed">
          Si ya realizaste el pago de alguno de estos documentos, envíanos el comprobante para registrarlo.
          {org?.email && <> Consultas: {org.email}{org.phone ? ` · ${org.phone}` : ''}.</>}
        </footer>
      </article>
    </div>
  )
}
