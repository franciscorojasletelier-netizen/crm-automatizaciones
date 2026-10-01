'use client'

// Panel "Enviar cobro": el ejecutivo elige canal (correo o WhatsApp) y
// tono, revisa el texto sugerido con el estado de cuenta y lo envía. Queda
// registrado como gestión en cada documento abierto del cliente.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, MessageCircle, Send, X, CheckCircle2 } from 'lucide-react'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { useDialog } from '@/lib/use-dialog'
import { clp } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  TONE_META, emailMessage, whatsappMessage, suggestedTone, waPhone, waLink,
  type Statement, type Tone,
} from '@/lib/cobranza-mensajes'

type Channel = 'email' | 'whatsapp'

export interface SendCollectionProps {
  companyId: string
  companyName: string
  contact: { full_name: string | null; email: string | null; phone: string | null } | null
  statement: Statement
  senderName: string | null
  orgName: string | null
  canSendEmail: boolean
  /** Remitente del sistema (Resend) si no usa su cuenta; null = su cuenta conectada. */
  emailFrom?: string | null
  /** Canal con que abre el panel (botones separados en la ficha). */
  initialChannel?: Channel
  variant?: 'primary' | 'secondary'
  label?: string
}

export default function SendCollection({
  companyId, companyName, contact, statement, senderName, orgName, canSendEmail, emailFrom = null,
  initialChannel = 'email', variant = 'primary', label = 'Enviar cobro',
}: SendCollectionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [tone, setTone] = useState<Tone>(() => suggestedTone(statement))
  const [to, setTo] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const base = { statement, companyName, contactName: contact?.full_name, senderName, orgName }
  const [subject, setSubject] = useState(() => emailMessage({ ...base, tone }).subject)
  const [body, setBody] = useState(() => emailMessage({ ...base, tone }).body)
  const [waBody, setWaBody] = useState(() => whatsappMessage({ ...base, tone }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const dialogRef = useDialog<HTMLFormElement>(open, () => { if (!busy) setOpen(false) }, busy)

  const waNumber = useMemo(() => waPhone(phone), [phone])
  const disabled = statement.lines.length === 0

  function applyTone(t: Tone) {
    setTone(t)
    const m = emailMessage({ ...base, tone: t })
    setSubject(m.subject); setBody(m.body)
    setWaBody(whatsappMessage({ ...base, tone: t }))
  }

  function openPanel() {
    setChannel(initialChannel); setError(''); setDone(''); setOpen(true)
  }

  async function log(payload: Record<string, string>) {
    const res = await fetch('/api/cobranza/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo completar el envío')
    return data as { ok: true; warning?: string }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!to.trim()) { setError('Indica el correo del cliente.'); return }
    setBusy(true)
    try {
      const r = await log({ channel: 'email', to: to.trim(), subject, body })
      setDone(r.warning ?? `Correo enviado a ${to.trim()}. Quedó registrado como gestión.`)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  async function sendWhatsApp() {
    setError('')
    if (!waNumber) { setError('El teléfono no es válido. Usa formato +56 9 1234 5678.'); return }
    // La pestaña se abre en el mismo gesto del clic (si no, el navegador la bloquea).
    window.open(waLink(waNumber, waBody), '_blank', 'noopener,noreferrer')
    setBusy(true)
    try {
      await log({ channel: 'whatsapp', to: `+${waNumber}`, body: waBody })
      setDone('Se abrió WhatsApp con el mensaje listo. Quedó registrado como gestión.')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" onClick={openPanel} disabled={disabled}
        title={disabled ? 'El cliente no tiene saldo pendiente' : undefined}
        className={variant === 'primary' ? buttonClass.primary : buttonClass.secondary}>
        {initialChannel === 'whatsapp' ? <MessageCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="send-collection-title">
          <div className="absolute inset-0 bg-slate-900/30" onClick={busy ? undefined : () => setOpen(false)} />
          <form ref={dialogRef} tabIndex={-1}
            onSubmit={channel === 'email' ? sendEmail : e => { e.preventDefault(); sendWhatsApp() }}
            className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200 outline-none">
            <header className="flex items-center justify-between px-5 h-14 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h2 id="send-collection-title" className="text-base font-semibold text-slate-900">Enviar cobro</h2>
                <p className="text-xs text-slate-500 truncate">
                  {companyName} · {statement.lines.length} {statement.lines.length === 1 ? 'documento' : 'documentos'} · <span className="tabular-nums">{clp(statement.total)}</span>
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Cerrar"
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </header>

            {done ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <p className="text-sm font-medium text-slate-900">Listo</p>
                <p className="mt-1 text-sm text-slate-500 max-w-xs">{done}</p>
                <button type="button" onClick={() => setOpen(false)} className={cn(buttonClass.secondary, 'mt-5')}>Cerrar</button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100" role="tablist" aria-label="Canal">
                    {([['email', 'Correo', Mail], ['whatsapp', 'WhatsApp', MessageCircle]] as const).map(([k, l, Icon]) => (
                      <button key={k} type="button" role="tab" aria-selected={channel === k} onClick={() => { setChannel(k); setError('') }}
                        className={cn('h-8 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                          channel === k ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}>
                        <Icon className="w-3.5 h-3.5" />{l}
                      </button>
                    ))}
                  </div>

                  <fieldset>
                    <legend className={labelClass}>Tono</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(TONE_META) as Tone[]).map(t => (
                        <button key={t} type="button" aria-pressed={tone === t} onClick={() => applyTone(t)} title={TONE_META[t].hint}
                          className={cn('h-7 px-2.5 rounded-md border text-[13px] transition-colors',
                            tone === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                          {TONE_META[t].label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Sugerido según la mora: <span className="font-medium text-slate-700">{TONE_META[suggestedTone(statement)].label}</span>
                      {statement.maxDaysLate > 0 && <> · atraso máximo {statement.maxDaysLate} días</>}
                    </p>
                  </fieldset>

                  {channel === 'email' ? (
                    <>
                      {!canSendEmail ? (
                        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                          No hay correo configurado. Conecta tu cuenta en <a href="/configuracion" className="font-medium underline">Configuración</a> o pide al administrador activar el correo del sistema.
                        </p>
                      ) : emailFrom ? (
                        <p className="text-xs text-slate-500">
                          Se envía desde <span className="font-medium text-slate-700">{emailFrom}</span> y las respuestas del cliente llegan a tu correo.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Se envía desde tu cuenta de correo conectada.</p>
                      )}
                      <div>
                        <label htmlFor="sc-to" className={labelClass}>Para</label>
                        <input id="sc-to" type="email" value={to} onChange={e => setTo(e.target.value)} required
                          placeholder="cliente@empresa.cl" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="sc-subject" className={labelClass}>Asunto</label>
                        <input id="sc-subject" value={subject} onChange={e => setSubject(e.target.value)} required maxLength={200} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="sc-body" className={labelClass}>Mensaje</label>
                        <textarea id="sc-body" value={body} onChange={e => setBody(e.target.value)} rows={16} maxLength={10000}
                          className={cn(inputClass, 'h-auto py-2 text-[13px] leading-relaxed resize-y')} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="sc-phone" className={labelClass}>Teléfono</label>
                        <input id="sc-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                          placeholder="+56 9 1234 5678" className={cn(inputClass, 'tabular-nums')} />
                        {phone && !waNumber && <p className="mt-1 text-xs text-red-700">Número no válido.</p>}
                      </div>
                      <div>
                        <label htmlFor="sc-wa" className={labelClass}>Mensaje</label>
                        <textarea id="sc-wa" value={waBody} onChange={e => setWaBody(e.target.value)} rows={12} maxLength={4000}
                          className={cn(inputClass, 'h-auto py-2 text-[13px] leading-relaxed resize-y')} />
                        <p className="mt-1 text-xs text-slate-500">Se abre WhatsApp (web o app) con este texto listo; tú lo envías desde ahí.</p>
                      </div>
                    </>
                  )}

                  {error && <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
                </div>

                <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 shrink-0">
                  <button type="button" onClick={() => setOpen(false)} disabled={busy} className={buttonClass.ghost}>Cancelar</button>
                  {channel === 'email' ? (
                    <button type="submit" disabled={busy || !canSendEmail} className={buttonClass.primary}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar correo
                    </button>
                  ) : (
                    <button type="button" onClick={sendWhatsApp} disabled={busy || !waNumber} className={buttonClass.primary}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} Abrir WhatsApp
                    </button>
                  )}
                </footer>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
