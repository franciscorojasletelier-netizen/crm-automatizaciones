import Sidebar from '@/components/layout/sidebar'
import GlobalChat from '@/components/chat/global-chat'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole, type Role } from '@/lib/roles'

export interface NavCounts {
  leads: number
  tareas: number
  tareasVencidas: number
  empresas: number
  proyectos: number
  pipeline: number
}

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  is_active: boolean
}

async function getLayoutData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { counts: emptyNavCounts(), profile: null, chatMessages: [], userId: '', userName: '' }

    const now = new Date().toISOString()

    const [profileRes, leads, tareas, tareasVencidas, empresas, proyectos, chatMessages] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, is_active').eq('id', user.id).single(),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false).lt('due_date', now),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
      supabase.from('team_messages')
        .select('id, content, user_id, created_at, profiles:user_id(full_name, email)')
        .is('deal_id', null)
        .order('created_at', { ascending: true })
        .limit(50),
    ])

    const profile = profileRes.data as UserProfile | null

    return {
      profile,
      counts: {
        leads: leads.count ?? 0,
        tareas: tareas.count ?? 0,
        tareasVencidas: tareasVencidas.count ?? 0,
        empresas: empresas.count ?? 0,
        proyectos: proyectos.count ?? 0,
        pipeline: leads.count ?? 0,
      },
      chatMessages: chatMessages.data ?? [],
      userId: user.id,
      userName: profile?.full_name ?? profile?.email ?? 'Usuario',
    }
  } catch {
    return { counts: emptyNavCounts(), profile: null, chatMessages: [], userId: '', userName: '' }
  }
}

function emptyNavCounts(): NavCounts {
  return { leads: 0, tareas: 0, tareasVencidas: 0, empresas: 0, proyectos: 0, pipeline: 0 }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { counts, profile, chatMessages, userId, userName } = await getLayoutData()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar counts={counts} profile={profile} />
      <main className="flex-1 overflow-auto pt-[52px] pb-[60px] md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Chat global flotante — visible en todo el dashboard */}
      {userId && (
        <GlobalChat
          currentUserId={userId}
          currentUserName={userName}
          initialMessages={chatMessages as any}
        />
      )}
    </div>
  )
}
