// Cola "A quién cobrar hoy": clientes ordenados por urgencia, con las
// acciones de cobro a un toque (llamar, WhatsApp, correo, estado de cuenta).

import Link from 'next/link'
import { Phone, FileText, CheckCircle2 } from 'lucide-react'
import { Panel, buttonClass } from '@/components/ui/page'
import SendCollection from '@/components/cobranza/send-collection'
import { money, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { QUEUE_REASON, type Invoice, type QueueItem } from '@/lib/cobranza'
import { buildStatement } from '@/lib/cobranza-mensajes'
import type { Contact } from '@/lib/cobranza-server'
import type { EmailOrg } from '@/lib/cobranza-email'

interface Props {
  queue: QueueItem[]
  invoices: Invoice[]
  today: string
  contacts: Map<string, Contact>
  sender: { senderName: string | null; orgName: string | null; canSendEmail: boolean; emailFrom: string | null; emailOrg: EmailOrg }
  showAll: boolean
  limit?: number
  /** Moneda de la organización. */
  currency: string
}

export default function CollectionQueue({ queue, invoices, today, contacts, sender, showAll, limit = 8, currency }: Props) {
  const pending = queue.filter(q => !q.handledToday)
  const handled = queue.filter(q => q.handledToday)
  const visible = showAll ? pending : pending.slice(0, limit)

  return (
    <Panel padded={false}
      title="A quién cobrar hoy"
      description={pending.length
        ? `${pending.length} ${pending.length === 1 ? 'cliente' : 'clientes'} por gestionar · ordenados por urgencia y monto`
        : 'Nada pendiente para hoy'}
      actions={handled.length > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> {handled.length} gestionado{handled.length === 1 ? '' : 's'} hoy
        </span>
      )}>
      {pending.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 text-center">
          {queue.length ? 'Ya gestionaste a todos los clientes de hoy.' : 'No hay compromisos, vencimientos ni documentos por vencer en los próximos días.'}
        </p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {visible.map((q, idx) => {
            const meta = QUEUE_REASON[q.reason]
            const contact = contacts.get(q.companyId) ?? null
            const statement = buildStatement(invoices.filter(i => i.company_id === q.companyId), today)
            const send = {
              companyId: q.companyId, companyName: q.companyName, contact, statement, ...sender,
            }
            return (
              <li key={q.companyId} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center justify-center tabular-nums" aria-hidden>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/cobranza/${q.leadInvoiceId}`} className="text-sm font-medium text-slate-900 hover:text-accent-700 hover:underline truncate">
                        {q.companyName}
                      </Link>
                      <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium', meta.chip)}>
                        {meta.label}{q.reason === 'mora_alta' || q.reason === 'vencido' ? ` · ${q.maxDaysLate} d` : ''}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {q.overdue > 0
                        ? <><span className="font-medium text-red-700">{money(q.overdue, currency)} vencido</span> de {money(q.balance, currency)}</>
                        : <>{money(q.balance, currency)} por cobrar</>}
                      {' · '}{q.documents} {q.documents === 1 ? 'documento' : 'documentos'}
                      {' · '}{q.lastActivityAt ? `última gestión ${timeAgo(q.lastActivityAt)}` : 'sin gestiones'}
                      {contact?.full_name ? ` · ${contact.full_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:shrink-0 pl-9 md:pl-0">
                  {contact?.phone && (
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className={buttonClass.secondary} aria-label={`Llamar a ${q.companyName}`}>
                      <Phone className="w-3.5 h-3.5" /> Llamar
                    </a>
                  )}
                  <SendCollection {...send} initialChannel="whatsapp" variant="secondary" label="WhatsApp" />
                  <SendCollection {...send} initialChannel="email" variant="secondary" label="Correo" />
                  <Link href={`/cobranza/estado/${q.companyId}`} className={buttonClass.ghost} aria-label={`Estado de cuenta de ${q.companyName}`} title="Estado de cuenta">
                    <FileText className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {!showAll && pending.length > limit && (
        <div className="px-4 py-2.5 border-t border-slate-100">
          <Link href="/cobranza?cola=todos" className="text-[13px] font-medium text-accent-700 hover:underline">
            Ver los {pending.length} clientes →
          </Link>
        </div>
      )}
    </Panel>
  )
}
