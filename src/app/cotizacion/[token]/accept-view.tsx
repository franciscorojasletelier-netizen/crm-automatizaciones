'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, AlertCircle, Zap, Mail, FileCheck2 } from 'lucide-react'
import { formatMoney, money } from '@/lib/format'
import { DATE_ONLY_TZ } from '@/lib/dates'
import { quoteTotals, quoteTaxes, type QuoteDoc, type QuoteDeal, type QuoteOrg } from '@/lib/quotes'
import { normalizePaymentTerms } from '@/lib/payment-terms'
import { formatRut, isValidRut } from '@/lib/rut'
import PaymentScheduleTable from '@/components/quotes/payment-schedule'
import { acceptanceDeclaration } from '@/lib/quote-declaration'

interface Item { description: string; quantity: number; unit_price: number }

const REJECT_REASONS = ['Precio', 'Elegí otro proveedor', 'Ya no lo necesito', 'Plazos', 'Alcance no calza']
const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400'

type Data = { quote: QuoteDoc & { accepted_by_name?: string | null; accepted_hash?: string | null }; deal: QuoteDeal | null; org: QuoteOrg | null; codeTarget: string | null }

export default function QuoteAcceptView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [deciding, setDeciding] = useState<'accepted' | 'rejected' | null>(null)
  const [decisionError, setDecisionError] = useState('')
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reasonTag, setReasonTag] = useState('')
  const [reasonText, setReasonText] = useState('')
  // Firma
  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [invoiceNote, setInvoiceNote] = useState<string | null>(null)

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

  // La pestaña del cliente muestra la empresa que cotiza, no el nombre del CRM.
  useEffect(() => {
    if (!data) return
    document.title = `Cotización #${data.quote.quote_number} · ${data.org?.display_name || data.org?.name || 'Cotización'}`
  }, [data])

  // Motivo opcional: el rápido elegido y/o el comentario libre.
  function rejectionReason() {
    return [reasonTag, reasonText.trim()].filter(Boolean).join(' — ') || undefined
  }

  async function sendCode() {
    setSendingCode(true); setDecisionError('')
    try {
      const res = await fetch(`/api/public/cotizacion/${token}/codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setDecisionError(json.error ?? 'No se pudo enviar el código'); return }
      setCodeSentTo(json.sentTo)
    } catch { setDecisionError('Error de conexión') } finally { setSendingCode(false) }
  }

  async function decide(decision: 'accepted' | 'rejected') {
    if (decision === 'accepted') {
      if (!name.trim()) { setDecisionError('Ingresa tu nombre completo'); return }
      if (!isValidRut(rut)) { setDecisionError('El RUT no es válido'); return }
      if (code.length !== 6) { setDecisionError('Ingresa el código de 6 dígitos que te enviamos'); return }
      if (!acceptTerms) { setDecisionError('Debes aceptar las condiciones de pago'); return }
    }
    setDeciding(decision)
    setDecisionError('')
    try {
      const res = await fetch(`/api/public/cotizacion/${token}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'accepted'
          ? { decision, name: name.trim(), rut, role: role.trim(), code, acceptTerms }
          : { decision, reason: rejectionReason() }),
      })
      const json = await res.json()
      if (!res.ok) { setDecisionError(json.error ?? 'No se pudo registrar la respuesta'); setDeciding(null); return }
      if (decision === 'accepted') setInvoiceNote(json.invoiceNote ?? null)
      setData(prev => prev && ({ ...prev, quote: { ...prev.quote, status: decision, accepted_by_name: decision === 'accepted' ? name.trim() : null, accepted_hash: json.hash ?? null } }))
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

  const { quote, deal, org, codeTarget } = data
  const orgName = org?.display_name || org?.name || 'Nuestra empresa'
  const company = deal?.companies?.name ?? null
  const items: Item[] = quote.items ?? []
  const cur = quote.currency ?? 'CLP'
  const { subtotal, taxLines, total } = quoteTotals(items, quoteTaxes(quote), cur)
  const terms = normalizePaymentTerms(quote.payment_terms)
  const declaration = acceptanceDeclaration(quote.quote_number, company)

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          {org?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo externo de Storage
            <img src={org.logo_url} alt={orgName} className="h-9 max-w-[160px] object-contain" />
          ) : (
            <div className="bg-accent-600 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold text-slate-900">{orgName}</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 md:p-8">
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Cotización #{quote.quote_number}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Para {company ?? '—'}</p>
            </div>
            {quote.valid_until && (
              <p className="text-xs text-slate-400">Válida hasta {new Date(quote.valid_until).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ })}</p>
            )}
          </div>

          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-700">{item.description} <span className="text-slate-400">× {item.quantity}</span></span>
                <span className="font-medium text-slate-800 whitespace-nowrap">{formatMoney(item.quantity * item.unit_price, cur)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1 mb-6">
            <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{money(subtotal, cur)}</span></div>
            {taxLines.map((t, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-500"><span>{t.label} ({t.rate.toLocaleString('es-CL')} %)</span><span>{money(t.amount, cur)}</span></div>
            ))}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1"><span>Total{cur !== 'CLP' ? ` (${cur})` : ''}</span><span>{money(total, cur)}</span></div>
          </div>

          <PaymentScheduleTable terms={terms} conditions={quote.payment_conditions} total={total} currency={cur} />

          {quote.notes && <p className="text-xs text-slate-500 mb-6 whitespace-pre-wrap">{quote.notes}</p>}

          {quote.status === 'accepted' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">Cotización aceptada{quote.accepted_by_name ? ` por ${quote.accepted_by_name}` : ''}.</p>
                  {invoiceNote && <p className="mt-1">Emitiremos la factura de la primera cuota en las próximas horas hábiles. {invoiceNote}.</p>}
                  <p className="mt-1 text-emerald-700">Te enviamos el comprobante de aceptación por correo.</p>
                </div>
              </div>
              <a href={`/cotizacion/${token}/comprobante`} className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 py-2.5 rounded-lg">
                <FileCheck2 className="w-4 h-4" /> Ver comprobante de aceptación
              </a>
            </div>
          ) : quote.status === 'rejected' ? (
            <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 rounded-lg px-4 py-3">
              <XCircle className="w-5 h-5 text-slate-500 shrink-0" />
              <p className="text-sm font-semibold text-slate-600">Cotización rechazada. Gracias por avisarnos.</p>
            </div>
          ) : quote.status !== 'sent' ? (
            <p className="text-sm text-slate-400 text-center">Esta cotización todavía no está disponible para responder.</p>
          ) : showRejectForm ? (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-slate-700">¿Nos cuentas por qué? <span className="font-normal text-slate-400">(opcional)</span></p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motivo del rechazo">
                {REJECT_REASONS.map(r => (
                  <button key={r} type="button" onClick={() => setReasonTag(t => t === r ? '' : r)} aria-pressed={reasonTag === r}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${reasonTag === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <textarea aria-label="Comentario (opcional)" value={reasonText} onChange={e => setReasonText(e.target.value)} rows={3} maxLength={800}
                placeholder="Comentario (opcional)"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
              {decisionError && <p role="alert" className="text-xs text-red-600">{decisionError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => decide('rejected')} disabled={deciding !== null}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 py-2.5 rounded-lg disabled:opacity-50 transition-colors">
                  {deciding === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar rechazo'}
                </button>
                <button type="button" onClick={() => setShowRejectForm(false)} className="text-sm font-semibold text-slate-500 px-3">Cancelar</button>
              </div>
            </div>
          ) : showAcceptForm ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Firma de aceptación</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="sig-name" className="block text-xs font-semibold text-slate-600 mb-1">Nombre completo</label>
                  <input id="sig-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" className={field} />
                </div>
                <div>
                  <label htmlFor="sig-rut" className="block text-xs font-semibold text-slate-600 mb-1">RUT</label>
                  <input id="sig-rut" value={rut} onChange={e => setRut(e.target.value)} onBlur={() => rut && setRut(formatRut(rut))} placeholder="12.345.678-5"
                    aria-invalid={!!rut && !isValidRut(rut)} className={field} />
                  {rut && !isValidRut(rut) && <p className="mt-1 text-[11px] text-red-600">RUT no válido</p>}
                </div>
                <div>
                  <label htmlFor="sig-role" className="block text-xs font-semibold text-slate-600 mb-1">Cargo <span className="font-normal text-slate-400">(opcional)</span></label>
                  <input id="sig-role" value={role} onChange={e => setRole(e.target.value)} maxLength={80} placeholder="Gerente general" className={field} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Verificación por correo</p>
                {!codeSentTo ? (
                  <>
                    {codeTarget
                      ? <p className="text-xs text-slate-600">Te enviaremos un código de 6 dígitos a <b>{codeTarget}</b>.</p>
                      : (
                        <div>
                          <label htmlFor="sig-email" className="block text-xs text-slate-600 mb-1">Tu correo</label>
                          <input id="sig-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className={field} />
                        </div>
                      )}
                    <button type="button" onClick={sendCode} disabled={sendingCode || (!codeTarget && !email.trim())}
                      className="flex items-center gap-2 text-sm font-semibold text-emerald-700 border border-emerald-200 bg-white hover:bg-emerald-50 px-3 py-2 rounded-lg disabled:opacity-50">
                      {sendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar código
                    </button>
                  </>
                ) : (
                  <div>
                    <label htmlFor="sig-code" className="block text-xs text-slate-600 mb-1">Código enviado a {codeSentTo}</label>
                    <div className="flex gap-2">
                      <input id="sig-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                        className={`${field} tracking-[0.4em] text-center font-semibold max-w-[10rem]`} />
                      <button type="button" onClick={sendCode} disabled={sendingCode} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2">
                        {sendingCode ? 'Enviando…' : 'Reenviar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0" />
                <span>{declaration}</span>
              </label>

              {decisionError && <p role="alert" className="text-xs text-red-600">{decisionError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => decide('accepted')} disabled={deciding !== null || !acceptTerms || code.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg disabled:opacity-50 transition-colors">
                  {deciding === 'accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Firmar y aceptar'}
                </button>
                <button type="button" onClick={() => setShowAcceptForm(false)} className="text-sm font-semibold text-slate-500 px-3">Cancelar</button>
              </div>
              <p className="text-[11px] text-slate-400">Firma electrónica simple (Ley 19.799): quedan registrados tu nombre, RUT, el correo verificado, la fecha, la IP y una copia exacta de lo aceptado. Recibirás el comprobante por correo.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDecisionError(''); setShowAcceptForm(true) }} disabled={deciding !== null}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Aceptar
              </button>
              <button type="button" onClick={() => { setDecisionError(''); setShowRejectForm(true) }} disabled={deciding !== null}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-lg disabled:opacity-50 transition-colors">
                <XCircle className="w-4 h-4" /> Rechazar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
