'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Minimize2, Trash2, AlertCircle } from 'lucide-react'
import { timeAgo, getInitials } from '@/lib/format'
import { useFloatingDock, dockHiddenClass } from '@/components/providers/floating-dock'

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



const COLORS = [
  'bg-slate-600', 'bg-accent-600', 'bg-emerald-700',
  'bg-amber-600', 'bg-rose-600', 'bg-teal-700',
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
  const dock = useFloatingDock()
  const { report } = dock
  // Mensajes sin leer → punto en la pestaña lateral del celular.
  useEffect(() => { report('team', open ? 0 : unread) }, [report, open, unread])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  const scrollDown = useCallback(() => {
    // Solo desplaza el contenedor del chat, no la página completa
    const list = bottomRef.current?.parentElement
    if (list) list.scrollTop = list.scrollHeight
  }, [])

  useEffect(() => {
    if (open) scrollDown()
  }, [open, messages.length, scrollDown])

  // Poll mensajes de otros usuarios cada 5 s cuando el chat está abierto
  useEffect(() => {
    if (!open) return

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
        // profiles es a-uno; sin tipos de base se infiere como arreglo.
        const incoming = (data as unknown as Message[]).filter(m => !ids.has(m.id) && m.user_id !== currentUserId)
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
    <div className={`fixed bottom-[76px] md:bottom-6 right-3 md:right-6 z-40 flex flex-col items-end gap-3 transition-all duration-200 ${!open && !dock.open ? dockHiddenClass : ''}`}>
      {open && (
        <div className="w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: 'min(500px, calc(100dvh - 10rem))' }}>

          <div className="bg-slate-900 px-4 py-3 flex items-center gap-2 shrink-0"
             >
            <div className="w-7 h-7 rounded-lg bg-accent-500/30 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-accent-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Chat del equipo</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] text-slate-400">En vivo</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimizar chat"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 bg-slate-50/50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <MessageCircle className="w-8 h-8 text-slate-200" />
                <p className="text-sm text-slate-400 font-medium">Canal del equipo</p>
                <p className="text-xs text-slate-300">Aún no hay mensajes</p>
              </div>
            )}
            {grouped.map((msg) => {
              const isMe = msg.user_id === currentUserId
              const initials = getInitials(msg.profiles.full_name, msg.profiles.email, '?')
              const name = msg.profiles.full_name ?? 'Usuario'
              const color = userColor(msg.user_id)
              const isTemp = msg.id.startsWith('temp-')

              return (
                <div key={msg.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}>
                  <div className="w-6 h-6 shrink-0 self-end">
                    {msg.isLast && (
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${color}`}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {msg.isFirst && !isMe && (
                      <p className="text-[11px] font-bold text-slate-500 mb-0.5 px-1">{name}</p>
                    )}
                    <div className="flex items-end gap-1 group/msg">
                      {isMe && !isTemp && (
                        <button type="button" onClick={() => deleteMessage(msg.id)} aria-label="Eliminar mensaje"
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-400">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <div className={`px-3 py-1.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words transition-opacity ${
                        isTemp ? 'opacity-60' : 'opacity-100'
                      } ${isMe
                        ? 'bg-accent-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                    {msg.isLast && (
                      <p className="text-[11px] text-slate-400 mt-0.5 px-1">{isTemp ? 'Enviando...' : timeAgo(msg.created_at, 'short')}</p>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="mx-3 mb-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 text-xs" aria-label="Descartar error"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-accent-300 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
              <textarea aria-label="Mensaje al equipo... (Enter)" ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Mensaje al equipo... (Enter)"
                rows={1} style={{ resize: 'none', minHeight: '20px', maxHeight: '80px' }}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed" />
              <button aria-label="Enviar mensaje" onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition-all hover:scale-105 shrink-0"
                style={{ background: input.trim() ? 'var(--color-accent-600)' : 'var(--color-slate-200)' }}>
                <Send className={`w-3.5 h-3.5 ${input.trim() ? 'text-white' : 'text-slate-400'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => { setOpen(!open); setUnread(0) }} aria-label={open ? "Cerrar chat del equipo" : "Abrir chat del equipo"} aria-expanded={open}
        className="w-11 h-11 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center relative transition-colors"
        style={{ background: open ? 'var(--color-slate-900)' : 'var(--color-accent-600)' }}>
        {open ? <X className="w-5 h-5 md:w-6 md:h-6 text-white" /> : <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
