'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageCircle, Trash2 } from 'lucide-react'

interface Message {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: { full_name: string | null; email: string | null }
}

interface Props {
  dealId: string
  currentUserId: string
  currentUserName: string
  initialMessages: Message[]
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

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

const COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-green-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-teal-600',
]

function userColor(userId: string) {
  let hash = 0
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length
  return COLORS[hash]
}

export default function DealChat({ dealId, currentUserId, currentUserName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Scroll al último mensaje
  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollDown() }, [messages, scrollDown])

  // Suscripción realtime
  useEffect(() => {
    const channel = supabase
      .channel(`deal-chat-${dealId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `deal_id=eq.${dealId}`,
        },
        async (payload) => {
          // Obtener el perfil del autor del nuevo mensaje
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', payload.new.user_id)
            .single()

          const newMsg: Message = {
            ...(payload.new as any),
            profiles: profile ?? { full_name: null, email: null },
          }
          setMessages(prev => {
            // Evitar duplicados
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'team_messages',
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [dealId, supabase])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    await supabase.from('team_messages').insert({
      content: text,
      user_id: currentUserId,
      deal_id: dealId,
    })

    setSending(false)
    inputRef.current?.focus()
  }

  async function deleteMessage(id: string) {
    setDeletingId(id)
    await supabase.from('team_messages').delete().eq('id', id)
    setDeletingId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Agrupar mensajes consecutivos del mismo usuario
  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].user_id !== msg.user_id,
    isLast:  i === messages.length - 1 || messages[i + 1].user_id !== msg.user_id,
  }))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '480px' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <MessageCircle className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-900">Chat del equipo</h2>
        <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-1">
          {messages.length}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          En vivo
        </span>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <MessageCircle className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400 font-medium">Sin mensajes aún</p>
            <p className="text-xs text-slate-300">Sé el primero en escribir</p>
          </div>
        )}

        {grouped.map((msg) => {
          const isMe = msg.user_id === currentUserId
          const initials = getInitials(msg.profiles.full_name, msg.profiles.email)
          const name = msg.profiles.full_name ?? msg.profiles.email ?? 'Usuario'
          const color = userColor(msg.user_id)

          return (
            <div key={msg.id}
              className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : 'flex-row'} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}>
              {/* Avatar — solo en el primer mensaje del grupo */}
              <div className="w-7 h-7 shrink-0 self-end">
                {msg.isLast && (
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${color}`}>
                    {initials}
                  </div>
                )}
              </div>

              <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Nombre — solo en el primer msg del grupo */}
                {msg.isFirst && !isMe && (
                  <p className="text-[10px] font-bold text-slate-500 mb-1 px-1">{name}</p>
                )}

                <div className="relative group/msg flex items-end gap-1.5">
                  {/* Botón eliminar — solo mis mensajes */}
                  {isMe && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      disabled={deletingId === msg.id}
                      className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 self-center"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* Burbuja */}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isMe
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  } ${msg.isFirst && isMe ? 'rounded-tr-sm' : ''} ${msg.isFirst && !isMe ? 'rounded-tl-sm' : ''}`}>
                    {msg.content}
                  </div>
                </div>

                {/* Timestamp — solo en el último msg del grupo */}
                {msg.isLast && (
                  <p className="text-[9px] text-slate-400 mt-0.5 px-1">{timeAgo(msg.created_at)}</p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            style={{ resize: 'none', minHeight: '24px', maxHeight: '96px' }}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-8 h-8 flex items-center justify-center rounded-xl disabled:opacity-30 transition-all hover:scale-105 shrink-0"
            style={{ background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0' }}
          >
            <Send className={`w-4 h-4 ${input.trim() ? 'text-white' : 'text-slate-400'}`} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 px-1">Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}
