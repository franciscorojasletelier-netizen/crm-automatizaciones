'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, Trash2, AlertCircle, MessageCircle } from 'lucide-react'

interface DirectMessage {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  read_at: string | null
}

interface Recipient {
  id: string
  name: string
  email: string | null
}

interface Props {
  currentUserId: string
  recipient: Recipient
  onClose: () => void
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function getInitials(name: string, email: string | null) {
  if (name && name !== '—') return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

export default function DirectChat({ currentUserId, recipient, onClose }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Filtro de la conversación: mensajes entre ambos en cualquier sentido
  const pairFilter =
    `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipient.id}),` +
    `and(sender_id.eq.${recipient.id},recipient_id.eq.${currentUserId})`

  const scrollDown = useCallback(() => {
    // Solo desplaza el contenedor del chat, no la página completa
    const list = bottomRef.current?.parentElement
    if (list) list.scrollTop = list.scrollHeight
  }, [])

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('id, sender_id, recipient_id, content, created_at, read_at')
      .or(pairFilter)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data as DirectMessage[])
    setLoading(false)
  }, [supabase, pairFilter])

  // Carga inicial + polling cada 5 s
  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => { scrollDown() }, [messages, scrollDown])

  // Marcar como leídos los recibidos sin leer
  useEffect(() => {
    const unreadIds = messages
      .filter(m => m.recipient_id === currentUserId && !m.read_at)
      .map(m => m.id)
    if (unreadIds.length === 0) return
    supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
      .then(() => {})
  }, [messages, currentUserId, supabase])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    setInput('')

    const tempId = `temp-${Date.now()}`
    const optimistic: DirectMessage = {
      id: tempId,
      sender_id: currentUserId,
      recipient_id: recipient.id,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages(prev => [...prev, optimistic])

    const { data, error: err } = await supabase
      .from('direct_messages')
      .insert({ sender_id: currentUserId, recipient_id: recipient.id, content: text })
      .select('id, sender_id, recipient_id, content, created_at, read_at')
      .single()

    if (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
      setError(`Error: ${err.message}`)
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? (data as DirectMessage) : m))
    }

    setSending(false)
    inputRef.current?.focus()
  }

  async function deleteMessage(id: string) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('direct_messages').delete().eq('id', id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const initials = getInitials(recipient.name, recipient.email)

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-[60] flex flex-col items-end">
      <div className="w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        style={{ height: 'min(500px, calc(100dvh - 10rem))' }}>

        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2.5 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{recipient.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-[10px] text-slate-400">Mensaje directo</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 bg-slate-50/50">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <MessageCircle className="w-8 h-8 text-slate-200" />
              <p className="text-sm text-slate-400 font-medium">Sin mensajes aún</p>
              <p className="text-xs text-slate-300">Escribe el primero 👋</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            const isTemp = msg.id.startsWith('temp-')
            return (
              <div key={msg.id} className={`flex group ${isMe ? 'justify-end' : 'justify-start'} mt-1`}>
                <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-end gap-1 group/msg">
                    {isMe && !isTemp && (
                      <button onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <div className={`px-3 py-1.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words transition-opacity ${
                      isTemp ? 'opacity-60' : 'opacity-100'
                    } ${isMe
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5 px-1">
                    {isTemp ? 'Enviando...' : timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mx-3 mb-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 text-xs">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={`Mensaje a ${recipient.name.split(' ')[0]}... (Enter)`}
              rows={1} style={{ resize: 'none', minHeight: '20px', maxHeight: '80px' }}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed" />
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="w-7 h-7 flex items-center justify-center rounded-xl disabled:opacity-30 transition-all hover:scale-105 shrink-0"
              style={{ background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0' }}>
              <Send className={`w-3.5 h-3.5 ${input.trim() ? 'text-white' : 'text-slate-400'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
