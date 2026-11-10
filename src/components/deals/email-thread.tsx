'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, X, Send, Loader2, Reply, BookmarkPlus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/format'
import {
  CLOSINGS, GREETINGS, closingText, composeBody, fillVars, firstName, greetingText, middleOf, middleOffset,
  pendingFillIns, replaceMiddle, swapPart, tokenizeVars, TEMPLATE_LIMITS, type ClosingKey, type EmailTemplate, type GreetingKey,
  type TemplateVars, type Treatment,
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
  dealId, contactId, contactEmail, contactName = null, contactTreatment = null, templates = [], personalTemplates = [], userId = null, templateVars = {},
  hasConnectedAccount, systemSender = null, emails: initialEmails,
}: {
  dealId: string
  contactId: string | null
  contactEmail: string | null
  /** Nombre del contacto principal, para el saludo. */
  contactName?: string | null
  /** Trato del contacto (Sr./Sra.) para el saludo formal. */
  contactTreatment?: Treatment
  /** Plantillas por situación de la empresa (o las por defecto). */
  templates?: EmailTemplate[]
  /** Plantillas propias del usuario (profiles.email_templates). */
  personalTemplates?: EmailTemplate[]
  /** Usuario actual: para guardar sus plantillas. */
  userId?: string | null
  /** Datos para {empresa} {miempresa} {vendedor} en las plantillas. */
  templateVars?: TemplateVars
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
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateSubject, setTemplateSubject] = useState('')
  const [mine, setMine] = useState<EmailTemplate[]>(personalTemplates)
  const [saveName, setSaveName] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  // Ids propios con prefijo para que no choquen con los de la empresa.
  const allTemplates = [...templates, ...mine.map(t => ({ ...t, id: `u:${t.id}` }))]
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
  const isContact = (address: string) =>
    !!contactEmail && address.trim().toLowerCase() === contactEmail.trim().toLowerCase()
  const nameFor = (address: string) => isContact(address) ? firstName(contactName) : ''
  const treatmentFor = (address: string) => isContact(address) ? contactTreatment : null

  function openCompose(replyTo?: EmailMessage) {
    const address = replyTo ? replyTo.from_address : (contactEmail ?? '')
    const pref = readPref()
    const gKey: GreetingKey = replyTo ? 'respuesta' : (pref.greeting && pref.greeting !== 'respuesta' ? pref.greeting : 'cordial')
    const cKey: ClosingKey = pref.closing ?? 'disposicion'
    const g = greetingText(gKey, nameFor(address), treatmentFor(address))
    const c = closingText(cKey)
    setComposing({ replyTo })
    setTo(address)
    setSubject(replyTo ? (replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject ?? ''}`) : '')
    setGreetingKey(gKey); setClosingKey(cKey); setGreeting(g); setClosing(c)
    setTemplateId(null); setTemplateSubject('')
    setBody(composeBody(g, '', c))
    setCaret(middleOffset(g))
    setError('')
  }

  function closeCompose() {
    setComposing(null); setTo(''); setSubject(''); setBody(''); setError(''); setGreeting(''); setClosing('')
    setTemplateId(null); setTemplateSubject('')
  }

  function pickTemplate(id: string) {
    const t = allTemplates.find(x => x.id === id)
    if (!t) return
    const middle = middleOf(body, greeting, closing)
    const current = allTemplates.find(x => x.id === templateId)
    const currentMiddle = current ? fillVars(current.body, { ...templateVars, nombre: nameFor(to) }) : ''
    if (middle && middle !== currentMiddle && !window.confirm('¿Reemplazar lo que escribiste por la plantilla?')) return
    const vars = { ...templateVars, nombre: nameFor(to) }
    const nextBody = fillVars(t.body, vars)
    const nextSubject = fillVars(t.subject, vars)
    setBody(b => replaceMiddle(b, greeting, closing, nextBody))
    // El asunto solo se pisa si está vacío o sigue siendo el de la plantilla anterior.
    if (!composing?.replyTo && (!subject.trim() || subject === templateSubject)) {
      setSubject(nextSubject); setTemplateSubject(nextSubject)
    }
    setTemplateId(id)
    setError('')
    setCaret(middleOffset(greeting) + nextBody.length)
  }

  // Guarda el asunto y el texto actuales como plantilla propia, con
  // {nombre}/{empresa} en vez de los datos de este cliente.
  async function saveAsTemplate() {
    const label = (saveName ?? '').trim().slice(0, TEMPLATE_LIMITS.label)
    const vars = { ...templateVars, nombre: nameFor(to) }
    const text = tokenizeVars(middleOf(body, greeting, closing), vars).slice(0, TEMPLATE_LIMITS.body)
    if (!label || !text || !userId) return
    const next = [...mine, {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label, subject: tokenizeVars(subject.trim(), vars).slice(0, TEMPLATE_LIMITS.subject), body: text,
    }].slice(-TEMPLATE_LIMITS.count)
    setSaveState('saving')
    const { error: err } = await createClient().from('profiles').update({ email_templates: next }).eq('id', userId)
    if (err) { setSaveState('idle'); setError(`No se pudo guardar la plantilla: ${err.message}`); return }
    setMine(next); setSaveName(null); setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2500)
  }

  function pickGreeting(key: GreetingKey) {
    const next = greetingText(key, nameFor(to), treatmentFor(to))
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

  const fillIns = pendingFillIns(subject, body)
  const emptyMessage = !middleOf(body, greeting, closing)

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim() || loading) return
    if (fillIns.length) { setError(`Completa o borra ${fillIns.join(', ')} antes de enviar.`); return }
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
          {templates.length > 0 && (
            <TemplatePicker label="Plantilla" options={templates.map(t => ({ key: t.id, label: t.label }))} value={templateId ?? ''} onPick={pickTemplate} />
          )}
          {mine.length > 0 && (
            <TemplatePicker label="Mías" options={mine.map(t => ({ key: `u:${t.id}`, label: t.label }))} value={templateId ?? ''} onPick={pickTemplate} />
          )}
          <TemplatePicker label="Saludo" options={GREETINGS} value={greetingKey} onPick={k => pickGreeting(k as GreetingKey)} />
          <textarea ref={bodyRef} aria-label="Escribe el mensaje" value={body} onChange={e => { setBody(e.target.value); setError('') }} rows={9} placeholder="Escribe el mensaje..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm leading-6 resize-y focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white placeholder:text-slate-400" />
          <TemplatePicker label="Despedida" options={CLOSINGS} value={closingKey} onPick={k => pickClosing(k as ClosingKey)} />
          {fillIns.length > 0 ? (
            <p className="text-[11px] text-amber-700">
              Completa antes de enviar: {fillIns.map(f => <span key={f} className="font-mono font-semibold mr-1.5">{f}</span>)}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">Tu firma (nombre, cargo, teléfono y logo) se agrega sola al enviar.</p>
          )}
          {!hasConnectedAccount && systemSender && (
            <p className="text-[11px] text-slate-500">Sale desde {systemSender} con el nombre de tu empresa; las respuestas llegan a tu correo.</p>
          )}
          {userId && !emptyMessage && (
            saveName === null ? (
              <button type="button" onClick={() => { setSaveName(''); setSaveState('idle') }}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-accent-700">
                {saveState === 'saved' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {saveState === 'saved' ? 'Guardada en tus plantillas' : 'Guardar como mi plantilla'}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input aria-label="Nombre de la plantilla" autoFocus value={saveName} maxLength={TEMPLATE_LIMITS.label}
                  onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveAsTemplate() } }}
                  placeholder="Nombre del botón, ej: Recordatorio de pago"
                  className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white" />
                <button type="button" onClick={saveAsTemplate} disabled={!saveName.trim() || saveState === 'saving'}
                  className="text-xs font-semibold text-white bg-accent-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {saveState === 'saving' ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setSaveName(null)} className="text-xs font-semibold text-slate-500 px-2 py-1.5">Cancelar</button>
                <p className="w-full text-[11px] text-slate-500">Se guarda el asunto y el texto del medio; el nombre y la empresa del cliente se cambian por {'{nombre}'} y {'{empresa}'}.</p>
              </div>
            )
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
