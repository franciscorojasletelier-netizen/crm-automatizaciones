'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageCircle, Loader2, RefreshCw, CheckCheck, Clock, AlertCircle } from 'lucide-react'

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

export default function WhatsAppChat({ dealId, contactName, contactPhone, canSend }: Props) {
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  if (!contactPhone) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
        <MessageCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">Chat WhatsApp</p>
        <p className="text-xs text-slate-400 mt-1">Este contacto no tiene teléfono registrado</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, #075e54, #128c7e)' }}>
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{contactName}</p>
          <p className="text-[10px] text-green-200">{contactPhone}</p>
        </div>
        <button onClick={fetchMessages} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[280px] max-h-[400px]"
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
            Los mensajes se envían desde el número de empresa +56 9 9141 4208
          </p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Solo gerentes y comerciales pueden enviar mensajes</p>
        </div>
      )}
    </div>
  )
}
