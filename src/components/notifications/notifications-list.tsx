'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCheck, Trash2, TrendingUp, CheckSquare, FolderOpen, Zap, Info } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

interface Props {
  initialNotifications: Notification[]
  userId: string
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })
}

function notifIcon(type: string) {
  switch (type) {
    case 'deal_assigned':  return { icon: TrendingUp, color: 'bg-blue-100 text-blue-600' }
    case 'task_due':       return { icon: CheckSquare, color: 'bg-amber-100 text-amber-600' }
    case 'task_overdue':   return { icon: CheckSquare, color: 'bg-red-100 text-red-600' }
    case 'stage_changed':  return { icon: TrendingUp, color: 'bg-purple-100 text-purple-600' }
    case 'automation':     return { icon: Zap, color: 'bg-indigo-100 text-indigo-600' }
    case 'project':        return { icon: FolderOpen, color: 'bg-emerald-100 text-emerald-600' }
    default:               return { icon: Info, color: 'bg-slate-100 text-slate-600' }
  }
}

function entityLink(type: string | null, id: string | null): string | null {
  if (!type || !id) return null
  if (type === 'deal')    return `/leads/${id}`
  if (type === 'task')    return `/tareas`
  if (type === 'project') return `/proyectos/${id}`
  return null
}

export default function NotificationsList({ initialNotifications, userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const supabase = createClient()
  const router = useRouter()

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    router.refresh()
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    router.refresh()
  }

  async function deleteNotif(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f === 'all' ? 'Todas' : `Sin leer (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filter === 'unread' ? 'No hay notificaciones sin leer' : 'Sin notificaciones'}
            </p>
            <p className="text-xs text-slate-300">
              {filter === 'unread' ? '¡Todo al día! 🎉' : 'Las notificaciones aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((n) => {
              const { icon: Icon, color } = notifIcon(n.type)
              const link = entityLink(n.entity_type, n.entity_id)

              const Content = (
                <div
                  className={`px-5 py-4 flex items-start gap-3.5 group hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                  onClick={() => { if (!n.is_read) markRead(n.id) }}
                >
                  <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {n.title}
                        {!n.is_read && (
                          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 align-middle" />
                        )}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium mt-0.5">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteNotif(n.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )

              return link ? (
                <Link key={n.id} href={link} className="block">{Content}</Link>
              ) : (
                <div key={n.id} className="cursor-pointer">{Content}</div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
