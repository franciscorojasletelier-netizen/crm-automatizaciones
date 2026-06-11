'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Minimize2, Trash2, AlertCircle } from 'lucide-react'

interface Message {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: { full_name: string | null; email: string | null }
}

interface Props {
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
  return '?'
}

const COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600',
  'from-emerald-500 to-green-600', 'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-cyan-500 to-teal-600',
]
function userColor(uid: string) {
  let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[h]
}

export default function GlobalChat({ currentUserId, currentUserName, initialMessages }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (open) { scrollDown(); setUnread(0) }
  }, [open, messages.length, scrollDown])

  // Poll mensajes de otros usuarios cada 5 s cuando el chat está abierto
  useEffect(() => {
    if (!open) return
    const latestId = messages[messages.length - 1]?.id

    const fetchNew = async () => {
      const query = supabase
        .from('team_messages')
        .select('id, content, user_id, created_at, profiles(full_name, email)')
        .is('deal_id', null)
        .order('created_at', { ascending: true })
        .limit(50)

      const { data } = await query
      if (!data) return
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id))
        const incoming = (data as any[]).filter(m => !ids.has(m.id) && m.user_id !== currentUserId)
        if (!incoming.length) return prev
        if (!open) setUnread(n => n + incoming.length)
        return [...prev, ...incoming]
      })
    }

    const interval = setInterval(fetchNew, 5_000)
    return () => clearInterval(interval)
  }, [open, supabase, currentUserId, messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    setInput('')

    // Actualización optimista
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      content: text,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
      profiles: { full_name: currentUserName || null, email: null },
    }
    setMessages(prev => [...prev, optimistic])

    const { data, error: err } = await supabase
      .from('team_messages')
      .insert({ content: text, user_id: currentUserId, deal_id: null })
      .select('id, content, user_id, created_at')
      .single()

    if (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
      setError(`Error: ${err.message}`)
    } else if (data) {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: data.id, created_at: data.created_at } : m
      ))
    }

    setSending(false)
    inputRef.current?.focus()
  }

  async function deleteMessage(id: string) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('team_messages').delete().eq('id', id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].user_id !== msg.user_id,
    isLast:  i === messages.length - 1 || messages[i + 1].user_id !== msg.user_id,
  }))

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: '500px' }}>

          <div className="px-4 py-3 flex items-center gap-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
            <div className="w-7 h-7 rounded-xl bg-indigo-500/30 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Chat del equipo</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] text-slate-400">En vivo</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 bg-slate-50/50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <MessageCircle className="w-8 h-8 text-slate-200" />
                <p className="text-sm text-slate-400 font-medium">Canal del equipo</p>
                <p className="text-xs text-slate-300">Di hola 👋</p>
              </div>
            )}
            {grouped.map((msg) => {
              const isMe = msg.user_id === currentUserId
              const initials = getInitials(msg.profiles.full_name, msg.profiles.email)
              const name = msg.profiles.full_name ?? 'Usuario'
              const color = userColor(msg.user_id)
              const isTemp = msg.id.startsWith('temp-')

              return (
                <div key={msg.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}>
                  <div className="w-6 h-6 shrink-0 self-end">
                    {msg.isLast && (
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br ${color}`}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {msg.isFirst && !isMe && (
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5 px-1">{name}</p>
                    )}
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
                    {msg.isLast && (
                      <p className="text-[9px] text-slate-400 mt-0.5 px-1">{isTemp ? 'Enviando...' : timeAgo(msg.created_at)}</p>
                    )}
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

          <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Mensaje al equipo... (Enter)"
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
      )}

      <button onClick={() => { setOpen(!open); setUnread(0) }}
        className="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center relative hover:scale-105 transition-all"
        style={{ background: open ? '#1e1b4b' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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
