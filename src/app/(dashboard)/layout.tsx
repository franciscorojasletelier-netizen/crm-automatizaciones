import Sidebar from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/roles'

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

async function getLayoutData(): Promise<{ counts: NavCounts; profile: UserProfile | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { counts: emptyNavCounts(), profile: null }

    const now = new Date().toISOString()

    const [profileRes, leads, tareas, tareasVencidas, empresas, proyectos] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, is_active').eq('id', user.id).single(),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false).lt('due_date', now),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
    ])

    return {
      profile: profileRes.data as UserProfile | null,
      counts: {
        leads: leads.count ?? 0,
        tareas: tareas.count ?? 0,
        tareasVencidas: tareasVencidas.count ?? 0,
        empresas: empresas.count ?? 0,
        proyectos: proyectos.count ?? 0,
        pipeline: leads.count ?? 0,
      },
    }
  } catch {
    return { counts: emptyNavCounts(), profile: null }
  }
}

function emptyNavCounts(): NavCounts {
  return { leads: 0, tareas: 0, tareasVencidas: 0, empresas: 0, proyectos: 0, pipeline: 0 }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { counts, profile } = await getLayoutData()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar counts={counts} profile={profile} />
      <main className="flex-1 overflow-auto pt-[52px] pb-[60px] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
