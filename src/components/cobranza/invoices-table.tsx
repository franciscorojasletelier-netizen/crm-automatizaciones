'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Handshake, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clp, formatCLP } from '@/lib/format'
import { DATE_ONLY_TZ } from '@/lib/dates'
import { EmptyState, inputClass } from '@/components/ui/page'
import {
  type Invoice, STATUS_META, DOCUMENT_TYPE_LABEL, balanceOf, daysOverdue, effectiveStatus, invoiceCode, isOpen, daysBetween,
} from '@/lib/cobranza'

type Filter = 'abiertos' | 'vencidos' | 'pagados' | 'anulados' | 'todos'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'abiertos', label: 'Por cobrar' },
  { key: 'vencidos', label: 'Vencidos' },
  { key: 'pagados',  label: 'Pagados' },
  { key: 'anulados', label: 'Anulados' },
  { key: 'todos',    label: 'Todos' },
]

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: '2-digit', month: 'short', year: '2-digit' })

export default function InvoicesTable({ invoices, today, initialFilter = 'abiertos', canManage }: {
  invoices: Invoice[]
  today: string
  initialFilter?: Filter
  canManage: boolean
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [query, setQuery] = useState('')

  const counts = useMemo(() => ({
    abiertos: invoices.filter(isOpen).length,
    vencidos: invoices.filter(i => daysOverdue(i, today) > 0).length,
    pagados:  invoices.filter(i => i.status === 'pagada').length,
    anulados: invoices.filter(i => i.status === 'anulada').length,
    todos:    invoices.length,
  }), [invoices, today])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices
      .filter(i => {
        if (filter === 'abiertos') return isOpen(i)
        if (filter === 'vencidos') return daysOverdue(i, today) > 0
        if (filter === 'pagados') return i.status === 'pagada'
        if (filter === 'anulados') return i.status === 'anulada'
        return true
      })
      .filter(i => !q || [i.companies?.name, i.description, i.document_folio, invoiceCode(i)]
        .some(v => v?.toLowerCase().includes(q)))
      // Lo más urgente arriba: más días de mora, luego vencimiento más próximo.
      .sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today) || a.due_date.localeCompare(b.due_date))
  }, [invoices, filter, query, today])

  const total = rows.reduce((s, i) => s + balanceOf(i), 0)

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs">
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-200 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Filtrar documentos">
          {FILTERS.map(f => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn('h-7 px-2.5 rounded-md text-[13px] whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {f.label}
              <span className={cn('ml-1.5 tabular-nums', filter === f.key ? 'text-slate-300' : 'text-slate-400')}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente, concepto o folio"
            aria-label="Buscar documentos" className={cn(inputClass, 'h-8 pl-8')} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet}
          title={invoices.length === 0 ? 'Aún no hay documentos por cobrar' : 'Ningún documento coincide'}
          description={invoices.length === 0
            ? (canManage ? 'Crea el primero desde "Nuevo documento" o desde un deal ganado.' : 'Finanzas registrará aquí los documentos de tus deals.')
            : 'Prueba con otro filtro o término de búsqueda.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th scope="col" className="font-medium px-4 py-2.5">Documento</th>
                <th scope="col" className="font-medium px-3 py-2.5">Cliente</th>
                <th scope="col" className="font-medium px-3 py-2.5">Vencimiento</th>
                <th scope="col" className="font-medium px-3 py-2.5">Estado</th>
                <th scope="col" className="font-medium px-3 py-2.5 text-right">Monto</th>
                <th scope="col" className="font-medium px-4 py-2.5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(inv => {
                const status = effectiveStatus(inv, today)
                const meta = STATUS_META[status]
                const late = daysOverdue(inv, today)
                const until = daysBetween(today, inv.due_date)
                const balance = balanceOf(inv)
                return (
                  <tr key={inv.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/cobranza/${inv.id}`} className="block focus-visible:outline-offset-4">
                        <span className="font-medium text-slate-900 group-hover:text-accent-700">{invoiceCode(inv)}</span>
                        <span className="block text-xs text-slate-500 truncate max-w-[260px]">
                          {DOCUMENT_TYPE_LABEL[inv.document_type]}{inv.document_folio ? ` N° ${inv.document_folio}` : ''} · {inv.description}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-800 max-w-[220px] truncate">{inv.companies?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      <span className="text-slate-800">{fmtDate(inv.due_date)}</span>
                      {isOpen(inv) && (
                        <span className={cn('block text-xs', late > 0 ? 'text-red-700 font-medium' : until <= 7 ? 'text-amber-700' : 'text-slate-500')}>
                          {late > 0 ? `${late} ${late === 1 ? 'día' : 'días'} de mora` : until === 0 ? 'Vence hoy' : `En ${until} ${until === 1 ? 'día' : 'días'}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium', meta.chip)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} aria-hidden />
                        {meta.label}
                      </span>
                      {inv.next_promise_date && isOpen(inv) && inv.next_promise_date >= today && (
                        <span className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                          <Handshake className="w-3 h-3" /> Promete {fmtDate(inv.next_promise_date)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCLP(inv.amount)}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums font-medium', balance > 0 ? (late > 0 ? 'text-red-700' : 'text-slate-900') : 'text-slate-400')}>
                      {balance > 0 ? formatCLP(balance) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60">
                <td colSpan={5} className="px-4 py-2.5 text-xs text-slate-500">
                  {rows.length} {rows.length === 1 ? 'documento' : 'documentos'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{clp(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
