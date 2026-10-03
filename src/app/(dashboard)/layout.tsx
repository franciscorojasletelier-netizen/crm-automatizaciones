import Sidebar from '@/components/layout/sidebar'
import GlobalChat from '@/components/chat/global-chat'
import { createClient } from '@/lib/supabase/server'
import { type Role } from '@/lib/roles'
import { getStages } from '@/lib/stages'
import { getDisabledModules } from '@/lib/modules'
import { chileDateString } from '@/lib/dates'

export interface NavCounts {
  leads: number
  tareas: number
  tareasVencidas: number
  empresas: number
  proyectos: number
  pipeline: number
  notificaciones: number
  cobranzaVencida: number
}

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  is_active: boolean
  section_access: string[] | null
}

async function getLayoutData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { counts: emptyNavCounts(), profile: null, chatMessages: [], userId: '', userName: '', isPlatformOwner: false, stages: [], disabledModules: new Set<string>(), organizationName: null }

    const now = new Date().toISOString()

    // El rol decide si los contadores son globales (gerente/admin) o propios
    const profileRes = await supabase.from('profiles')
      .select('id, full_name, email, role, is_active, section_access, organization_id').eq('id', user.id).single()
    const seesAll = ['super_admin', 'admin', 'gerente'].includes(profileRes.data?.role ?? '')
    // Explícito: sin esto, un platform_owner vería en su propio sidebar el
    // embudo y los módulos de TODAS las organizaciones mezclados.
    const orgId: string | undefined = profileRes.data?.organization_id ?? undefined

    const tasksBase = () => {
      let q = supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false)
      if (!seesAll) q = q.eq('assigned_to', user.id)
      return q
    }

    const [leads, tareas, tareasVencidas, empresas, proyectos, chatMessages, notificaciones, platformOwner, stages, org, disabledModules, cobranzaVencida] = await Promise.all([
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      tasksBase(),
      tasksBase().lt('due_date', now),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
      supabase.from('team_messages')
        .select('id, content, user_id, created_at, profiles:user_id(full_name, email)')
        .is('deal_id', null)
        .order('created_at', { ascending: true })
        .limit(50),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
      supabase.from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle(),
      getStages(supabase, orgId),
      orgId ? supabase.from('organizations').select('name, display_name').eq('id', orgId).maybeSingle() : Promise.resolve({ data: null }),
      getDisabledModules(supabase, orgId),
      // RLS acota a lo que el usuario puede ver de cobranza (0 si no ve nada).
      supabase.from('invoices').select('id', { count: 'exact', head: true })
        .in('status', ['pendiente', 'parcial']).lt('due_date', chileDateString()),
    ])

    const profile = profileRes.data as UserProfile | null

    return {
      profile,
      isPlatformOwner: !!platformOwner.data,
      organizationName: (org.data as { display_name?: string | null; name?: string } | null)?.display_name || (org.data as { name?: string } | null)?.name || null,
      stages,
      disabledModules,
      counts: {
        leads: leads.count ?? 0,
        tareas: tareas.count ?? 0,
        tareasVencidas: tareasVencidas.count ?? 0,
        empresas: empresas.count ?? 0,
        proyectos: proyectos.count ?? 0,
        pipeline: leads.count ?? 0,
        notificaciones: notificaciones.count ?? 0,
        cobranzaVencida: cobranzaVencida.count ?? 0,
      },
      chatMessages: chatMessages.data ?? [],
      userId: user.id,
      userName: profile?.full_name ?? profile?.email ?? 'Usuario',
    }
  } catch {
    return { counts: emptyNavCounts(), profile: null, chatMessages: [], userId: '', userName: '', isPlatformOwner: false, stages: [], disabledModules: new Set<string>(), organizationName: null }
  }
}

function emptyNavCounts(): NavCounts {
  return { leads: 0, tareas: 0, tareasVencidas: 0, empresas: 0, proyectos: 0, pipeline: 0, notificaciones: 0, cobranzaVencida: 0 }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { counts, profile, chatMessages, userId, userName, isPlatformOwner, stages, disabledModules, organizationName } = await getLayoutData()

  return (
    <div className="flex h-screen bg-background print:block print:h-auto">
      <Sidebar counts={counts} profile={profile} isPlatformOwner={isPlatformOwner} stages={stages} disabledModules={disabledModules} organizationName={organizationName} />
      <main className="flex-1 overflow-auto pt-[52px] pb-[148px] md:pt-0 md:pb-36 print:p-0 print:overflow-visible">
        {children}
      </main>

      {/* Chat global flotante — visible en todo el dashboard */}
      {userId && (
        <div className="print:hidden">
          <GlobalChat
            currentUserId={userId}
            currentUserName={userName}
            initialMessages={chatMessages as unknown as React.ComponentProps<typeof GlobalChat>['initialMessages']}
          />
        </div>
      )}
    </div>
  )
}
