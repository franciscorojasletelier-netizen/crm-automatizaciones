import Link from 'next/link'
import { Plus, Wallet } from 'lucide-react'
import { clp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Panel, buttonClass } from '@/components/ui/page'
import { STATUS_META, balanceOf, effectiveStatus, invoiceCode, type Invoice } from '@/lib/cobranza'
import { quoteTotals, type QuoteItem } from '@/lib/quotes'

type AcceptedQuote = { id: string; quote_number: number; items: QuoteItem[]; tax_rate: number }

/**
 * Cobranza desde el deal: qué se ha facturado y cuánto falta. Cierra el
 * traspaso comercial → finanzas: al ganar, el cobro se crea desde acá con
 * cliente, deal y monto ya cargados (la cotización aceptada manda sobre el
 * valor estimado).
 */
export default function DealInvoicesPanel({ invoices, today, canCreate, companyId, companyName, dealId, estimatedValue, acceptedQuote }: {
  invoices: Invoice[]
  today: string
  canCreate: boolean
  companyId: string | null
  companyName: string | null
  dealId: string
  estimatedValue: number | null
  acceptedQuote: AcceptedQuote | null
}) {
  const billed = invoices.filter(i => i.status !== 'anulada').reduce((s, i) => s + Number(i.amount), 0)
  const pending = invoices.reduce((s, i) => s + balanceOf(i), 0)

  const amount = acceptedQuote ? quoteTotals(acceptedQuote.items, acceptedQuote.tax_rate).total : estimatedValue ?? 0
  const concept = acceptedQuote
    ? `Cotización N° ${acceptedQuote.quote_number}${companyName ? ` — ${companyName}` : ''}`
    : `Servicios${companyName ? ` — ${companyName}` : ''}`
  const params = new URLSearchParams({ nuevo: '1', deal: dealId, concepto: concept })
  if (companyId) params.set('empresa', companyId)
  if (amount > 0) params.set('monto', String(Math.round(amount)))
  if (acceptedQuote) params.set('cotizacion', acceptedQuote.id)

  if (invoices.length === 0 && !canCreate) return null

  return (
    <Panel
      title="Cobranza"
      description={invoices.length ? `Facturado ${clp(billed)} · pendiente ${clp(pending)}` : 'Sin documentos por cobrar'}
      actions={canCreate && companyId && (
        <Link href={`/cobranza?${params}`} className={buttonClass.secondary}>
          <Plus className="w-3.5 h-3.5" /> Crear cobro
        </Link>
      )}
      padded={invoices.length === 0}
    >
      {invoices.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-slate-500">
          <Wallet className="w-4 h-4 text-slate-400" />
          {acceptedQuote ? `La cotización N° ${acceptedQuote.quote_number} fue aceptada: crea el cobro por ${clp(amount)}.` : 'Cuando se gane, crea aquí el documento por cobrar.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {invoices.map(inv => {
            const meta = STATUS_META[effectiveStatus(inv, today)]
            return (
              <li key={inv.id}>
                <Link href={`/cobranza/${inv.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900">{invoiceCode(inv)} <span className="font-normal text-slate-500">· {inv.description}</span></p>
                  </div>
                  <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-xs font-medium', meta.chip)}>{meta.label}</span>
                  <span className="w-28 text-right text-[13px] tabular-nums text-slate-900">{clp(balanceOf(inv))}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
