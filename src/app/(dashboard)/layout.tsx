import Sidebar from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'

export interface NavCounts {
  leads: number
  tareas: number
  tareasVencidas: number
  empresas: number
  proyectos: number
  pipeline: number
}

async function getNavCounts(): Promise<NavCounts> {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()

    const [leads, tareas, tareasVencidas, empresas, proyectos] = await Promise.all([
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false).lt('due_date', now),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
    ])

    return {
      leads: leads.count ?? 0,
      tareas: tareas.count ?? 0,
      tareasVencidas: tareasVencidas.count ?? 0,
      empresas: empresas.count ?? 0,
      proyectos: proyectos.count ?? 0,
      pipeline: leads.count ?? 0,
    }
  } catch {
    return { leads: 0, tareas: 0, tareasVencidas: 0, empresas: 0, proyectos: 0, pipeline: 0 }
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const counts = await getNavCounts()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar counts={counts} />
      <main className="flex-1 overflow-auto pt-[52px] pb-[60px] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
