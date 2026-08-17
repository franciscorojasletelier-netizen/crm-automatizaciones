'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { formatCLP } from '@/lib/format'
import { FileText, Plus, Trash2, Loader2, ExternalLink, Copy, Check } from 'lucide-react'

interface Item { description: string; quantity: number; unit_price: number }
interface Quote {
  id: string; quote_number: number; status: string; items: Item[]; tax_rate: number
  notes: string | null; valid_until: string | null; created_at: string; public_token: string | null
}

const STATUS_STYLE: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-amber-100 text-amber-700',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', expired: 'Vencida',
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        navigator.clipboard.writeText(`${window.location.origin}/cotizacion/${token}`)
        setCopied(true); setTimeout(() => setCopied(false), 1500)
      }}
      title="Copiar enlace para el cliente"
      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function total(items: Item[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  return { subtotal, tax: subtotal * (taxRate / 100), total: subtotal * (1 + taxRate / 100) }
}

export default function QuotesPanel({ dealId, quotes: initialQuotes, canEdit }: {
  dealId: string; quotes: Quote[]; canEdit: boolean
}) {
  const [quotes, setQuotes] = useState(initialQuotes)
  const [showNew, setShowNew] = useState(false)
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unit_price: 0 }])
  const [taxRate, setTaxRate] = useState(19)
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  function addItem() { setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function save(status: 'draft' | 'sent') {
    const cleanItems = items.filter(i => i.description.trim())
    if (cleanItems.length === 0) { setError('Agregá al menos un ítem con descripción'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.from('quotes').insert({
      deal_id: dealId, status, items: cleanItems, tax_rate: taxRate,
      notes: notes.trim() || null, valid_until: validUntil || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      // El link público (Fase 8.3, aceptar/rechazar) se genera al enviar
      // — antes de eso la cotización es un borrador interno sin sentido
      // de compartir. crypto.randomUUID() alcanza: no protege un secreto
      // de verdad, solo evita que alguien adivine la URL de otro cliente.
      public_token: status === 'sent' ? crypto.randomUUID() : null,
    }).select().single()
    setSaving(false)
    if (err) { setError(friendlyError(err.message)); return }
    setQuotes(prev => [data, ...prev])
    setShowNew(false)
    setItems([{ description: '', quantity: 1, unit_price: 0 }])
    setNotes(''); setValidUntil('')
    router.refresh()
  }

  const { subtotal, tax, total: totalAmount } = total(items, taxRate)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cotizaciones</h2>
        {canEdit && (
          <button onClick={() => setShowNew(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showNew && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={item.description} onChange={e => updateItem(i, { description: e.target.value })}
                  placeholder="Descripción" className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
                <input type="number" min={0} value={item.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) })}
                  placeholder="Cant." className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
                <input type="number" min={0} value={item.unit_price} onChange={e => updateItem(i, { unit_price: Number(e.target.value) })}
                  placeholder="Precio" className="w-28 text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
                <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={addItem} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">+ Agregar ítem</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">IVA (%)</label>
              <input type="number" min={0} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Válida hasta</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)"
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full resize-none" />

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              <p>Subtotal: {formatCLP(subtotal)}</p>
              <p>IVA: {formatCLP(tax)}</p>
              <p className="font-bold text-slate-800">Total: {formatCLP(totalAmount)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => save('draft')} disabled={saving}
                className="text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
                Guardar borrador
              </button>
              <button onClick={() => save('sent')} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Marcar como enviada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin cotizaciones todavía.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => {
            const { total: qTotal } = total(q.items, q.tax_rate)
            return (
              <Link key={q.id} href={`/leads/${dealId}/cotizacion/${q.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Cotización #{q.quote_number}</p>
                    <p className="text-[11px] text-slate-400">{formatCLP(qTotal)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                  {q.public_token && <CopyLinkButton token={q.public_token} />}
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
