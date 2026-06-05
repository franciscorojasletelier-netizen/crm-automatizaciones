export const dynamic = 'force-dynamic'
import { createClient, getCurrentProfile } from '@/lib/supabase/server'
import { Bell, CheckCheck } from 'lucide-react'
import NotificationsList from '@/components/notifications/notifications-list'

export default async function NotificacionesPage() {
  const { user, supabase } = await getCurrentProfile()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const unreadCount = (notifications ?? []).filter(n => !n.is_read).length

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl font-semibold">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount} nuevas
          </div>
        )}
      </div>

      <NotificationsList
        initialNotifications={notifications ?? []}
        userId={user.id}
      />
    </div>
  )
}
