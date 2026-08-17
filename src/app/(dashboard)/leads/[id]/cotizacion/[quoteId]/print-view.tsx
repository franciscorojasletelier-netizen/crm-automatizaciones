'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { formatCLP } from '@/lib/format'

interface Item { description: string; quantity: number; unit_price: number }

export default function QuotePrintView({ quote, deal, org, dealId }: {
  quote: any; deal: any; org: any; dealId: string
}) {
  const items: Item[] = quote.items ?? []
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  const tax = subtotal * (quote.tax_rate / 100)
  const total = subtotal + tax
  const orgName = org?.display_name || org?.name || 'Nuestra empresa'

  return (
    <div className="min-h-full bg-slate-100">
      {/* Barra de acciones — no se imprime */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between">
        <Link href={`/leads/${dealId}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al deal
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6 md:p-10 print:p-0">
        <div className="bg-white rounded-2xl print:rounded-none print:shadow-none shadow-sm border border-slate-200 print:border-none p-8">
          {/* Encabezado */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{orgName}</h1>
              {org?.address && <p className="text-xs text-slate-400 mt-0.5">{org.address}</p>}
              {(org?.phone || org?.email) && (
                <p className="text-xs text-slate-400">{[org?.phone, org?.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">Cotización #{quote.quote_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              {quote.valid_until && (
                <p className="text-xs text-slate-400">Válida hasta {new Date(quote.valid_until).toLocaleDateString('es-CL')}</p>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Para</p>
            <p className="text-sm font-semibold text-slate-800">{deal?.companies?.name ?? '—'}</p>
            {deal?.contacts?.full_name && <p className="text-xs text-slate-500">{deal.contacts.full_name}</p>}
            {deal?.contacts?.email && <p className="text-xs text-slate-500">{deal.contacts.email}</p>}
          </div>

          {/* Ítems */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left py-2">Descripción</th>
                <th className="text-right py-2">Cant.</th>
                <th className="text-right py-2">Precio</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2.5 text-slate-700">{item.description}</td>
                  <td className="py-2.5 text-right text-slate-500">{item.quantity}</td>
                  <td className="py-2.5 text-right text-slate-500">{formatCLP(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium text-slate-800">{formatCLP(item.quantity * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className="flex justify-end mb-6">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span>{formatCLP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IVA ({quote.tax_rate}%)</span><span>{formatCLP(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total</span><span>{formatCLP(total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {quote.status === 'accepted' && (
            <div className="mt-4 print:mt-6 bg-emerald-50 print:bg-transparent border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
              Aceptada por <b>{quote.accepted_by_name}</b> el {new Date(quote.accepted_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {quote.accepted_ip && <span className="text-emerald-600"> · IP {quote.accepted_ip}</span>}
            </div>
          )}
          {quote.status === 'rejected' && (
            <div className="mt-4 print:mt-6 bg-slate-100 print:bg-transparent border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
              Rechazada el {new Date(quote.rejected_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
