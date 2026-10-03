'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Send, Trash2, Copy, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { formatMoney, money } from '@/lib/format'
import { CHILE_TZ, DATE_ONLY_TZ } from '@/lib/dates'
import { quoteTotals, quoteTaxes, type QuoteDoc, type QuoteDeal, type QuoteOrg } from '@/lib/quotes'

interface Item { description: string; quantity: number; unit_price: number }


export default function QuotePrintView({ quote, deal, org, dealId, canEdit }: {
  quote: QuoteDoc & { id: string }; deal: QuoteDeal | null; org: QuoteOrg | null; dealId: string; canEdit: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'send' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const items: Item[] = quote.items ?? []
  const publicUrl = quote.public_token && typeof window !== 'undefined' ? `${window.location.origin}/cotizacion/${quote.public_token}` : null

  // Un borrador pasa a "enviada" al generar su link público (aceptar/rechazar).
  async function markSent() {
    setBusy('send'); setError('')
    const { error: err } = await createClient().from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString(), public_token: crypto.randomUUID() })
      .eq('id', quote.id).eq('status', 'draft')
    setBusy(null)
    if (err) { setError(friendlyError(err.message)); return }
    router.refresh()
  }

  async function removeDraft() {
    if (!confirm(`¿Eliminar el borrador de la cotización #${quote.quote_number}? No se puede deshacer.`)) return
    setBusy('delete'); setError('')
    const { data, error: err } = await createClient().from('quotes').delete().eq('id', quote.id).eq('status', 'draft').select('id')
    if (err || !data?.length) {
      setBusy(null)
      setError(err ? friendlyError(err.message) : 'No tienes permiso para eliminar esta cotización.')
      return
    }
    router.push(`/leads/${dealId}`)
    router.refresh()
  }

  function copyLink() {
    if (!publicUrl) return
    void navigator.clipboard.writeText(publicUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const cur = quote.currency ?? 'CLP'
  const { subtotal, taxLines, total } = quoteTotals(items, quoteTaxes(quote), cur)
  const orgName = org?.display_name || org?.name || 'Nuestra empresa'

  return (
    <div className="min-h-full bg-slate-100">
      {/* Barra de acciones — no se imprime */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between">
        <Link href={`/leads/${dealId}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-600 transition-colors whitespace-nowrap shrink-0">
          <ArrowLeft className="w-4 h-4" /> Volver al deal
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canEdit && quote.status === 'draft' && (
            <>
              <button type="button" onClick={removeDraft} disabled={!!busy}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar
              </button>
              <button type="button" onClick={markSent} disabled={!!busy}
                title="Genera el link para que el cliente la acepte o rechace"
                className="flex items-center gap-1.5 text-sm font-semibold text-accent-700 border border-accent-200 hover:bg-accent-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Marcar como enviada
              </button>
            </>
          )}
          {publicUrl && (
            <button type="button" onClick={copyLink}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar link del cliente'}
            </button>
          )}
          <button type="button" onClick={() => window.print()}
            className="bg-accent-600 flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-xs transition-all">
            <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>
      {error && <p role="alert" className="print:hidden max-w-2xl mx-auto mt-4 mx-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="max-w-2xl mx-auto p-6 md:p-10 print:p-0">
        <div className="bg-white rounded-lg print:rounded-none print:shadow-none shadow-sm border border-slate-200 print:border-none p-5 sm:p-8">
          {/* Encabezado */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
            <div>
              {org?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- logo externo de Storage, también para imprimir
                <img src={org.logo_url} alt={orgName} className="h-10 max-w-[180px] object-contain mb-2" />
              )}
              <h1 className="text-xl font-bold text-slate-900">{orgName}</h1>
              {org?.address && <p className="text-xs text-slate-400 mt-0.5">{org.address}</p>}
              {(org?.phone || org?.email) && (
                <p className="text-xs text-slate-400">{[org?.phone, org?.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">Cotización #{quote.quote_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(quote.created_at).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {quote.valid_until && (
                <p className="text-xs text-slate-400">Válida hasta {new Date(quote.valid_until).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ })}</p>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 mb-1">Para</p>
            <p className="text-sm font-semibold text-slate-800">{deal?.companies?.name ?? '—'}</p>
            {deal?.contacts?.full_name && <p className="text-xs text-slate-500">{deal.contacts.full_name}</p>}
            {deal?.contacts?.email && <p className="text-xs text-slate-500">{deal.contacts.email}</p>}
          </div>

          {/* Ítems */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-xs font-medium text-slate-500 border-b border-slate-200">
                <th className="text-left py-2">Descripción</th>
                <th className="text-right py-2 pl-3 whitespace-nowrap">Cant.</th>
                <th className="text-right py-2 pl-3 whitespace-nowrap hidden sm:table-cell print:table-cell">Precio</th>
                <th className="text-right py-2 pl-3 whitespace-nowrap">Total{cur !== 'CLP' ? ` (${cur})` : ''}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2.5 text-slate-700">{item.description}<span className="block sm:hidden print:hidden text-xs text-slate-400">{item.quantity} × {formatMoney(item.unit_price, cur)}</span></td>
                  <td className="py-2.5 pl-3 text-right text-slate-500 whitespace-nowrap">{item.quantity}</td>
                  <td className="py-2.5 pl-3 text-right text-slate-500 whitespace-nowrap hidden sm:table-cell print:table-cell">{formatMoney(item.unit_price, cur)}</td>
                  <td className="py-2.5 pl-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatMoney(item.quantity * item.unit_price, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className="flex justify-end mb-6">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span>{money(subtotal, cur)}</span>
              </div>
              {taxLines.map((t, i) => (
                <div key={i} className="flex justify-between text-slate-500">
                  <span>{t.label} ({t.rate.toLocaleString('es-CL')} %)</span><span>{money(t.amount, cur)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total</span><span>{money(total, cur)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">Notas</p>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {quote.status === 'accepted' && (
            <div className="mt-4 print:mt-6 bg-emerald-50 print:bg-transparent border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
              Aceptada por <b>{quote.accepted_by_name}</b> el {quote.accepted_at ? new Date(quote.accepted_at).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              {quote.accepted_ip && <span className="text-emerald-600"> · IP {quote.accepted_ip}</span>}
            </div>
          )}
          {quote.status === 'rejected' && (
            <div className="mt-4 print:mt-6 bg-slate-100 print:bg-transparent border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              Rechazada el {quote.rejected_at ? new Date(quote.rejected_at).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
