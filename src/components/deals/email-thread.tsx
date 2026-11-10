'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, X, Send, Loader2, Reply } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import {
  CLOSINGS, GREETINGS, NAME_PLACEHOLDER, closingText, composeBody, firstName, greetingText,
  middleOf, middleOffset, swapPart, type ClosingKey, type GreetingKey,
} from '@/lib/email-templates'

// Último saludo/despedida elegido: comodidad por navegador, no es crítico.
const PREF_KEY = 'crm.email.templates'
function readPref(): { greeting?: GreetingKey; closing?: ClosingKey } {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') } catch { return {} }
}
function savePref(pref: { greeting: GreetingKey; closing: ClosingKey }) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)) } catch { /* sin almacenamiento */ }
}

interface EmailMessage {
  id: string
  direction: 'inbound' | 'outbound'
  subject: string | null
  body_text: string | null
  from_address: string
  to_addresses: string[]
  provider_message_id: string | null
  thread_id: string | null
  sent_at: string
}


export default function EmailThread({
  dealId, contactId, contactEmail, contactName = null, hasConnectedAccount, systemSender = null, emails: initialEmails,
}: {
  dealId: string
  contactId: string | null
  contactEmail: string | null
  /** Nombre del contacto principal, para el saludo. */
  contactName?: string | null
  hasConnectedAccount: boolean
  /** Dirección del correo del sistema (Resend) si está activo: permite enviar sin cuenta conectada. */
  systemSender?: string | null
  emails: EmailMessage[]
}) {
  const canSend = hasConnectedAccount || !!systemSender
  const [list, setList] = useState(initialEmails)
  const [composing, setComposing] = useState<null | { replyTo?: EmailMessage }>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [greetingKey, setGreetingKey] = useState<GreetingKey>('cordial')
  const [closingKey, setClosingKey] = useState<ClosingKey>('disposicion')
  const [greeting, setGreeting] = useState('')
  const [closing, setClosing] = useState('')
  const [caret, setCaret] = useState<number | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  // Al abrir (o cambiar el saludo), el cursor queda en el espacio para escribir.
  useEffect(() => {
    if (caret === null || !bodyRef.current) return
    bodyRef.current.focus()
    bodyRef.current.setSelectionRange(caret, caret)
    setCaret(null)
  }, [caret])

  // El nombre solo se conoce si se le escribe al contacto del lead.
  const nameFor = (address: string) =>
    contactEmail && address.trim().toLowerCase() === contactEmail.trim().toLowerCase() ? firstName(contactName) : ''

  function openCompose(replyTo?: EmailMessage) {
    const address = replyTo ? replyTo.from_address : (contactEmail ?? '')
    const pref = readPref()
    const gKey: GreetingKey = replyTo ? 'respuesta' : (pref.greeting && pref.greeting !== 'respuesta' ? pref.greeting : 'cordial')
    const cKey: ClosingKey = pref.closing ?? 'disposicion'
    const g = greetingText(gKey, nameFor(address))
    const c = closingText(cKey)
    setComposing({ replyTo })
    setTo(address)
    setSubject(replyTo ? (replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject ?? ''}`) : '')
    setGreetingKey(gKey); setClosingKey(cKey); setGreeting(g); setClosing(c)
    setBody(composeBody(g, '', c))
    setCaret(middleOffset(g))
    setError('')
  }

  function closeCompose() {
    setComposing(null); setTo(''); setSubject(''); setBody(''); setError(''); setGreeting(''); setClosing('')
  }

  function pickGreeting(key: GreetingKey) {
    const next = greetingText(key, nameFor(to))
    setBody(b => swapPart(b, greeting, next, 'start'))
    setGreeting(next); setGreetingKey(key)
    setCaret(middleOffset(next))
    savePref({ greeting: key, closing: closingKey })
  }

  function pickClosing(key: ClosingKey) {
    const next = closingText(key)
    setBody(b => swapPart(b, closing, next, 'end'))
    setClosing(next); setClosingKey(key)
    savePref({ greeting: greetingKey, closing: key })
  }

  const missingName = body.includes(NAME_PLACEHOLDER)
  const emptyMessage = !middleOf(body, greeting, closing)

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim() || loading) return
    if (missingName) { setError(`Reemplaza ${NAME_PLACEHOLDER} por el nombre del cliente, o quítalo del saludo.`); return }
    if (emptyMessage) { setError('Escribe el mensaje entre el saludo y la despedida.'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId, contactId, to: to.trim(), subject: subject.trim(), body,
        replyToMessageId: composing?.replyTo?.provider_message_id ?? undefined,
        threadId: composing?.replyTo?.thread_id ?? undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Error al enviar'); return }
    setList(prev => [data.message, ...prev])
    closeCompose()
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Email</h2>
          {list.length > 0 && (
            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{list.length}</span>
          )}
        </div>
        {canSend ? (
          <button type="button" onClick={() => composing ? closeCompose() : openCompose()}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              composing ? 'bg-slate-100 text-slate-600' : 'bg-accent-50 text-accent-600 hover:bg-accent-100'
            }`}>
            {composing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {composing ? 'Cancelar' : 'Nuevo'}
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">Conecta tu correo en Configuración para enviar</span>
        )}
      </div>

      {composing && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-2.5">
          <input aria-label="Para" value={to} onChange={e => setTo(e.target.value)} placeholder="Para"
            className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white" />
          <input aria-label="Asunto" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto"
            className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white" />
          <TemplatePicker label="Saludo" options={GREETINGS} value={greetingKey} onPick={k => pickGreeting(k as GreetingKey)} />
          <textarea ref={bodyRef} aria-label="Escribe el mensaje" value={body} onChange={e => { setBody(e.target.value); setError('') }} rows={9} placeholder="Escribe el mensaje..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm leading-6 resize-y focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white placeholder:text-slate-400" />
          <TemplatePicker label="Despedida" options={CLOSINGS} value={closingKey} onPick={k => pickClosing(k as ClosingKey)} />
          {missingName ? (
            <p className="text-[11px] text-amber-700">No tenemos el nombre de este contacto: reemplaza <span className="font-mono font-semibold">{NAME_PLACEHOLDER}</span> en el saludo antes de enviar.</p>
          ) : (
            <p className="text-[11px] text-slate-500">Tu firma (nombre, cargo, teléfono y logo) se agrega sola al enviar.</p>
          )}
          {!hasConnectedAccount && systemSender && (
            <p className="text-[11px] text-slate-500">Sale desde {systemSender} con el nombre de tu empresa; las respuestas llegan a tu correo.</p>
          )}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={send} disabled={loading || !to.trim() || !subject.trim() || emptyMessage}
            className="bg-accent-600 flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-all "
             >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {list.length === 0 && !composing && (
          <div className="px-5 py-10 text-center">
            <Mail className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Sin correos aún</p>
          </div>
        )}
        {list.map(e => (
          <div key={e.id} className="px-5 py-3.5 flex gap-3.5 hover:bg-slate-50/50 transition-colors group">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              e.direction === 'outbound' ? 'bg-accent-50' : 'bg-sky-50'
            }`}>
              <Mail className={`w-4 h-4 ${e.direction === 'outbound' ? 'text-accent-600' : 'text-sky-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold ${e.direction === 'outbound' ? 'text-accent-600' : 'text-sky-600'}`}>
                  {e.direction === 'outbound' ? 'Enviado' : 'Recibido'}
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">{e.from_address}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">{e.subject || '(sin asunto)'}</p>
              {e.body_text && <p className="text-sm text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-wrap">{e.body_text}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium mt-1">{timeAgo(e.sent_at, 'long')}</span>
              {hasConnectedAccount && e.direction === 'inbound' && (
                <button onClick={() => openCompose(e)} title="Responder"
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-accent-600 transition-all">
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Fila de chips para elegir saludo o despedida. */
function TemplatePicker({ label, options, value, onPick }: {
  label: string
  options: { key: string; label: string }[]
  value: string
  onPick: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-500 mr-0.5">{label}:</span>
      {options.map(o => (
        <button key={o.key} type="button" onClick={() => onPick(o.key)} aria-pressed={value === o.key}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
            value === o.key ? 'bg-accent-50 border-accent-200 text-accent-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
