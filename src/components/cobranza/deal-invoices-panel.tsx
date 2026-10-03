import Link from 'next/link'
import { Plus, Wallet } from 'lucide-react'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Panel, buttonClass } from '@/components/ui/page'
import { STATUS_META, balanceOf, effectiveStatus, invoiceCode, type Invoice } from '@/lib/cobranza'
import { quoteTotals, quoteTaxes, type QuoteItem } from '@/lib/quotes'
import { useCurrency } from '@/components/providers/currency-provider'

type AcceptedQuote = { id: string; quote_number: number; items: QuoteItem[]; tax_rate: number; taxes?: unknown; currency?: string | null }

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
  const currency = useCurrency()
  const billed = invoices.filter(i => i.status !== 'anulada').reduce((s, i) => s + Number(i.amount), 0)
  const pending = invoices.reduce((s, i) => s + balanceOf(i), 0)

  // Una cotización en otra moneda no precarga el monto: el cobro va en la
  // moneda de la organización y no hay tipo de cambio que inventar.
  const quoteInOtherCurrency = !!acceptedQuote && (acceptedQuote.currency ?? 'CLP') !== currency
  const amount = acceptedQuote
    ? (quoteInOtherCurrency ? 0 : quoteTotals(acceptedQuote.items, quoteTaxes(acceptedQuote), currency).total)
    : estimatedValue ?? 0
  const concept = acceptedQuote
    ? `Cotización N° ${acceptedQuote.quote_number}${companyName ? ` — ${companyName}` : ''}`
    : `Servicios${companyName ? ` — ${companyName}` : ''}`
  const params = new URLSearchParams({ nuevo: '1', deal: dealId, concepto: concept })
  if (companyId) params.set('empresa', companyId)
  if (amount > 0) params.set('monto', String(amount))
  if (acceptedQuote) params.set('cotizacion', acceptedQuote.id)

  if (invoices.length === 0 && !canCreate) return null

  return (
    <Panel
      title="Cobranza"
      description={invoices.length ? `Facturado ${money(billed, currency)} · pendiente ${money(pending, currency)}` : 'Sin documentos por cobrar'}
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
          {acceptedQuote
            ? quoteInOtherCurrency
              ? `La cotización N° ${acceptedQuote.quote_number} fue aceptada en ${acceptedQuote.currency}: crea el cobro e ingresa el monto en ${currency}.`
              : `La cotización N° ${acceptedQuote.quote_number} fue aceptada: crea el cobro por ${money(amount, currency)}.`
            : canCreate ? `Deal ganado: crea el documento por cobrar${amount > 0 ? ` por ${money(amount, currency)}` : ''}.` : 'Aún no hay documentos por cobrar para este deal.'}
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
                  <span className="w-28 text-right text-[13px] tabular-nums text-slate-900">{money(balanceOf(inv), currency)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
