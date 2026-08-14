'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageCircle, Loader2, RefreshCw, CheckCheck, Clock, AlertCircle, X } from 'lucide-react'
import TemplatePicker from './template-picker'

interface WaMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  created_at: string
  sent_by: string | null
  profiles?: { full_name: string | null } | null
}

interface Props {
  dealId: string
  contactName: string
  contactPhone: string | null
  canSend: boolean
  orgPhone?: string | null
}

function timeStr(date: string) {
  return new Date(date).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read')      return <CheckCheck className="w-3 h-3 text-blue-400" />
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-slate-400" />
  if (status === 'failed')    return <AlertCircle className="w-3 h-3 text-red-400" />
  return <Clock className="w-3 h-3 text-slate-300" />
}

export default function WhatsAppChat({ dealId, contactName, contactPhone, canSend, orgPhone }: Props) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [unread, setUnread]     = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevInbound = useRef(0)
  const supabase  = createClient()

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*, profiles:sent_by(full_name)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) setMessages(data as WaMessage[])
    setLoading(false)
  }, [dealId, supabase])

  useEffect(() => {
    fetchMessages()
    // Poll cada 10s para mensajes nuevos
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Contador de mensajes entrantes nuevos mientras el panel está cerrado
  const inboundCount = messages.filter(m => m.direction === 'inbound').length
  useEffect(() => {
    if (!open && inboundCount > prevInbound.current) {
      setUnread(u => u + (inboundCount - prevInbound.current))
    }
    prevInbound.current = inboundCount
  }, [inboundCount, open])

  useEffect(() => {
    if (!open) return
    // Solo desplaza el contenedor del chat, no la página completa
    const list = bottomRef.current?.parentElement
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    setInput('')

    // Optimista
    const temp: WaMessage = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      body: text,
      status: 'sent',
      created_at: new Date().toISOString(),
      sent_by: null,
    }
    setMessages(prev => [...prev, temp])

    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, message: text }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessages(prev => prev.filter(m => m.id !== temp.id))
      setInput(text)
      setError(data.error ?? 'Error al enviar')
    } else {
      setMessages(prev => prev.map(m => m.id === temp.id ? { ...data.message, profiles: null } : m))
    }

    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Si el contacto no tiene teléfono (o el rol no puede verlo), no mostramos el widget
  if (!contactPhone) return null

  return (
    <div className="fixed bottom-36 md:bottom-24 right-3 md:right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: 'min(500px, calc(100dvh - 13rem))' }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #075e54, #128c7e)' }}>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{contactName}</p>
              <p className="text-[10px] text-green-200">WhatsApp · {contactPhone}</p>
            </div>
            <button onClick={fetchMessages} title="Actualizar"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setOpen(false)} title="Minimizar"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
            style={{ background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), #f0f2f5' }}>
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <MessageCircle className="w-8 h-8 text-slate-200" />
                <p className="text-xs text-slate-400 font-medium">Sin mensajes aún</p>
                <p className="text-[11px] text-slate-300">Envía el primer mensaje al cliente</p>
              </div>
            )}
            {messages.map(msg => {
              const isOut = msg.direction === 'outbound'
              const isTemp = msg.id.startsWith('temp-')
              return (
                <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                    isOut
                      ? 'bg-[#dcf8c6] text-slate-800 rounded-br-sm'
                      : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
                  } ${isTemp ? 'opacity-60' : ''}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] text-slate-400">{timeStr(msg.created_at)}</span>
                      {isOut && <StatusIcon status={isTemp ? 'sent' : msg.status} />}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-3 mb-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 text-xs">✕</button>
            </div>
          )}

          {/* Input */}
          {canSend ? (
            <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
              <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition-all">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Escribe un mensaje... (Enter para enviar)"
                  rows={1}
                  style={{ resize: 'none', minHeight: '20px', maxHeight: '80px' }}
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed"
                />
                <TemplatePicker contactName={contactName} onPick={text => setInput(text)} />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="w-8 h-8 flex items-center justify-center rounded-xl disabled:opacity-30 transition-all hover:scale-105 shrink-0"
                  style={{ background: input.trim() ? 'linear-gradient(135deg, #25d366, #128c7e)' : '#e2e8f0' }}>
                  {sending
                    ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                    : <Send className={`w-4 h-4 ${input.trim() ? 'text-white' : 'text-slate-400'}`} />
                  }
                </button>
              </div>
              <p className="text-[10px] text-slate-300 mt-1.5 text-center">
                {orgPhone ? `Se envía desde el número de empresa ${orgPhone}` : 'Se envía desde el número de WhatsApp Business de tu organización'}
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">Solo gerentes y comerciales pueden enviar mensajes</p>
            </div>
          )}
        </div>
      )}

      {/* Botón flotante */}
      <button onClick={() => { setOpen(!open); setUnread(0) }}
        title={`WhatsApp · ${contactName}`}
        className="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center relative hover:scale-105 transition-all"
        style={{ background: open ? '#075e54' : 'linear-gradient(135deg, #25d366, #128c7e)' }}>
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
