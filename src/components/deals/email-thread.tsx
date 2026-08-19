'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, X, Send, Loader2, Reply } from 'lucide-react'

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

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function EmailThread({
  dealId, contactId, contactEmail, hasConnectedAccount, emails: initialEmails,
}: {
  dealId: string
  contactId: string | null
  contactEmail: string | null
  hasConnectedAccount: boolean
  emails: EmailMessage[]
}) {
  const [list, setList] = useState(initialEmails)
  const [composing, setComposing] = useState<null | { replyTo?: EmailMessage }>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function openCompose(replyTo?: EmailMessage) {
    setComposing({ replyTo })
    setTo(replyTo ? replyTo.from_address : (contactEmail ?? ''))
    setSubject(replyTo ? (replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject ?? ''}`) : '')
    setBody('')
    setError('')
  }

  function closeCompose() {
    setComposing(null); setTo(''); setSubject(''); setBody(''); setError('')
  }

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim() || loading) return
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Email</h2>
          {list.length > 0 && (
            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{list.length}</span>
          )}
        </div>
        {hasConnectedAccount ? (
          <button onClick={() => composing ? closeCompose() : openCompose()}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
              composing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}>
            {composing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {composing ? 'Cancelar' : 'Nuevo'}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">Conectá tu correo en Configuración para enviar</span>
        )}
      </div>

      {composing && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-2.5">
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="Para"
            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto"
            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Escribe el mensaje..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={send} disabled={loading || !to.trim() || !subject.trim() || !body.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              e.direction === 'outbound' ? 'bg-indigo-50' : 'bg-sky-50'
            }`}>
              <Mail className={`w-4 h-4 ${e.direction === 'outbound' ? 'text-indigo-600' : 'text-sky-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold ${e.direction === 'outbound' ? 'text-indigo-600' : 'text-sky-600'}`}>
                  {e.direction === 'outbound' ? 'Enviado' : 'Recibido'}
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">{e.from_address}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">{e.subject || '(sin asunto)'}</p>
              {e.body_text && <p className="text-sm text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-wrap">{e.body_text}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium mt-1">{timeAgo(e.sent_at)}</span>
              {hasConnectedAccount && e.direction === 'inbound' && (
                <button onClick={() => openCompose(e)} title="Responder"
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all">
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
