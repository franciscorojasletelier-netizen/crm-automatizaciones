'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, AlertCircle, Zap } from 'lucide-react'
import { formatCLP } from '@/lib/format'

interface Item { description: string; quantity: number; unit_price: number }

export default function QuoteAcceptView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [deciding, setDeciding] = useState<'accepted' | 'rejected' | null>(null)
  const [decisionError, setDecisionError] = useState('')
  const [showAcceptForm, setShowAcceptForm] = useState(false)

  useEffect(() => {
    fetch(`/api/public/cotizacion/${token}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('No se pudo cargar la cotización'))
      .finally(() => setLoading(false))
  }, [token])

  async function decide(decision: 'accepted' | 'rejected') {
    if (decision === 'accepted' && !name.trim()) { setDecisionError('Ingresá tu nombre'); return }
    setDeciding(decision)
    setDecisionError('')
    try {
      const res = await fetch(`/api/public/cotizacion/${token}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setDecisionError(json.error ?? 'No se pudo registrar la respuesta'); setDeciding(null); return }
      setData((prev: any) => ({ ...prev, quote: { ...prev.quote, status: decision } }))
    } catch {
      setDecisionError('Error de conexión')
      setDeciding(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
    </div>
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm text-slate-500">{error || 'Cotización no encontrada'}</p>
      </div>
    </div>
  }

  const { quote, deal, org } = data
  const orgName = org?.display_name || org?.name || 'Nuestra empresa'
  const items: Item[] = quote.items ?? []
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const tax = subtotal * (quote.tax_rate / 100)
  const total = subtotal + tax

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">{orgName}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Cotización #{quote.quote_number}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Para {deal?.companies?.name ?? '—'}</p>
            </div>
            {quote.valid_until && (
              <p className="text-xs text-slate-400">Válida hasta {new Date(quote.valid_until).toLocaleDateString('es-CL')}</p>
            )}
          </div>

          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-700">{item.description} <span className="text-slate-400">× {item.quantity}</span></span>
                <span className="font-medium text-slate-800">{formatCLP(item.quantity * item.unit_price)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1 mb-6">
            <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{formatCLP(subtotal)}</span></div>
            <div className="flex justify-between text-xs text-slate-500"><span>IVA ({quote.tax_rate}%)</span><span>{formatCLP(tax)}</span></div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1"><span>Total</span><span>{formatCLP(total)}</span></div>
          </div>

          {quote.notes && <p className="text-xs text-slate-500 mb-6 whitespace-pre-wrap">{quote.notes}</p>}

          {quote.status === 'accepted' ? (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">Cotización aceptada. Nos vamos a contactar a la brevedad.</p>
            </div>
          ) : quote.status === 'rejected' ? (
            <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 rounded-xl px-4 py-3">
              <XCircle className="w-5 h-5 text-slate-500 shrink-0" />
              <p className="text-sm font-semibold text-slate-600">Cotización rechazada.</p>
            </div>
          ) : quote.status !== 'sent' ? (
            <p className="text-sm text-slate-400 text-center">Esta cotización todavía no está disponible para responder.</p>
          ) : showAcceptForm ? (
            <div className="space-y-2.5">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              {decisionError && <p className="text-xs text-red-600">{decisionError}</p>}
              <div className="flex gap-2">
                <button onClick={() => decide('accepted')} disabled={deciding !== null}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                  {deciding === 'accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar aceptación'}
                </button>
                <button onClick={() => setShowAcceptForm(false)} className="text-sm font-semibold text-slate-500 px-3">Cancelar</button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Al aceptar, queda registrado tu nombre, la fecha y la IP como evidencia de aceptación.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowAcceptForm(true)} disabled={deciding !== null}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Aceptar
              </button>
              <button onClick={() => decide('rejected')} disabled={deciding !== null}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                {deciding === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Rechazar</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
