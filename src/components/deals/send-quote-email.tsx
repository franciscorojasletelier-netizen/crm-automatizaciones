'use client'

// Enviar una cotización por correo: destinatario (contacto del deal),
// asunto y mensaje editables. El correo lleva el resumen y el botón para
// aceptar o rechazar en línea.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Send, X } from 'lucide-react'
import { useDialog } from '@/lib/use-dialog'
import { defaultQuoteMessage } from '@/lib/quote-email'

const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-400'

export default function SendQuoteEmail({ quoteId, quoteNumber, contactEmail, contactName, senderName, orgName, autoOpen = false, onClose, onSent }: {
  quoteId: string; quoteNumber: number; contactEmail?: string | null; contactName?: string | null
  senderName?: string | null; orgName: string
  /** Abre la ventana al montarse y no muestra el botón (recién guardada desde el panel). */
  autoOpen?: boolean
  onClose?: () => void
  onSent?: () => void
}) {
  const [open, setOpenState] = useState(autoOpen)
  const setOpen = (v: boolean) => { setOpenState(v); if (!v) onClose?.() }
  const [to, setTo] = useState(contactEmail ?? '')
  const [subject, setSubject] = useState(`Cotización N° ${quoteNumber} — ${orgName}`)
  const [message, setMessage] = useState(() => defaultQuoteMessage({ contactName, senderName, orgName, quoteNumber }))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const dialogRef = useDialog<HTMLFormElement>(open, () => setOpen(false), busy)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setResult(null)
    const res = await fetch(`/api/quotes/${quoteId}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: to.trim(), subject, message }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setResult({ ok: false, text: json.error ?? 'No se pudo enviar' }); return }
    setResult({ ok: true, text: `Enviada a ${to.trim()}${json.via ? ` desde ${json.via}` : ''}.` })
    onSent?.()
    router.refresh()
  }

  return (
    <>
      {!autoOpen && (
        <button type="button" onClick={() => { setResult(null); setOpen(true) }}
          className="flex items-center gap-1.5 text-sm font-semibold text-accent-700 border border-accent-200 hover:bg-accent-50 px-3 py-2 rounded-lg transition-colors">
          <Mail className="w-4 h-4" /> Enviar por correo
        </button>
      )}

      {open && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="send-quote-title">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setOpen(false)} aria-hidden />
          <form ref={dialogRef} tabIndex={-1} onSubmit={send}
            className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] outline-none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 id="send-quote-title" className="text-base font-semibold text-slate-900">Enviar cotización N° {quoteNumber}</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div>
                <label htmlFor="sq-to" className="block text-xs font-semibold text-slate-600 mb-1">Para</label>
                <input id="sq-to" type="email" required value={to} onChange={e => setTo(e.target.value)} placeholder="cliente@empresa.cl" className={field} />
              </div>
              <div>
                <label htmlFor="sq-subject" className="block text-xs font-semibold text-slate-600 mb-1">Asunto</label>
                <input id="sq-subject" required maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="sq-message" className="block text-xs font-semibold text-slate-600 mb-1">Mensaje</label>
                <textarea id="sq-message" required rows={7} maxLength={5000} value={message} onChange={e => setMessage(e.target.value)} className={`${field} resize-y leading-relaxed`} />
                <p className="mt-1 text-xs text-slate-500">Debajo del mensaje van el total, el detalle y el botón para que el cliente acepte o rechace en línea.</p>
              </div>
              {result && (
                <p role={result.ok ? 'status' : 'alert'} className={`text-[13px] rounded-md px-3 py-2 border ${result.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>{result.text}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-sm font-medium text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100">
                {result?.ok ? 'Cerrar' : 'Cancelar'}
              </button>
              {!result?.ok && (
                <button type="submit" disabled={busy} className="flex items-center gap-2 text-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 px-4 py-2 rounded-lg disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
