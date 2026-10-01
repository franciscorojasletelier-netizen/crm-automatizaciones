export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import LeadsTable from '@/components/leads/leads-table'
import ImportLeadsButton from '@/components/leads/import-leads-button'
import { formatCLP } from '@/lib/format'
import { getStages } from '@/lib/stages'
import { PageContainer, PageHeader, Panel, Badge, buttonClass } from '@/components/ui/page'

export default async function LeadsPage() {
  const { role, perms, supabase, canEdit, organizationId } = await requirePermission('leads')
  const stages = await getStages(supabase, organizationId ?? undefined)

  // La visibilidad por rol (propios + compartidos para comercial) la aplica
  // la RLS de deals; antes se repetía acá con 2 consultas extra y un IN gigante.

  // Con miles de deals abiertos, traer todo sin límite degrada linealmente
  // y sin techo — mismo tope que ya usa /pipeline.
  const LEADS_LIMIT = 500

  const query = supabase
    .from('deals')
    .select(`
      id, stage, pipeline_id, score, estimated_value, next_action, source,
      created_at, last_contacted_at,
      companies(name, industry),
      contacts:primary_contact_id(full_name, email),
      profiles:owner_id(id, full_name)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(LEADS_LIMIT)

  const countQuery = supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'open')

  // Team users para reasignación (solo gerente/admin los ve)
  const canReassign = ['super_admin', 'admin', 'gerente'].includes(role)
  const teamQuery = canReassign
    ? supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true)
        .in('role', ['super_admin', 'admin', 'gerente', 'comercial', 'produccion', 'soporte'])
    : Promise.resolve({ data: [] as any[] })

  // Deals ganados con proyectos pendientes de especificaciones; la empresa
  // viene embebida (antes: una segunda consulta con IN).
  const pendingQuery = supabase
    .from('projects')
    .select('id, name, deal_id, deal:deal_id(companies(name))')
    .eq('status', 'pendiente_especificaciones' as any)
    .not('deal_id', 'is', null)

  // Las cuatro consultas son independientes: en paralelo, no en cascada.
  const [{ data: deals }, { count: totalCount }, { data: teamUsers }, { data: pendingSpecRaw }] =
    await Promise.all([query, countQuery, teamQuery, pendingQuery])
  const pendingSpecDeals = (pendingSpecRaw ?? []) as any[]

  const total = totalCount ?? deals?.length ?? 0
  const totalValue = deals?.reduce((s, d: any) => s + (Number(d.estimated_value) || 0), 0) ?? 0
  const isFiltered = !['super_admin', 'gerente'].includes(role) // ve solo sus deals (RLS)
  const canCreate = perms.canCreateLeads && canEdit

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Leads"
        description={<>
          <span className="font-medium text-slate-700 tabular-nums">{total}</span> {total === 1 ? 'deal' : 'deals'} {isFiltered ? (total === 1 ? 'asignado a ti' : 'asignados a ti') : (total === 1 ? 'activo' : 'activos')}
          {totalValue > 0 && <> · <span className="font-medium text-slate-700 tabular-nums">{formatCLP(totalValue)}</span> en valor estimado</>}
        </>}
        actions={canCreate && <>
          <ImportLeadsButton />
          <Link href="/leads/nuevo" className={buttonClass.primary}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo lead</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </>}
      />

      {/* Deals ganados con especificaciones pendientes — requieren atención */}
      {pendingSpecDeals.length > 0 && (
        <Panel padded={false}
          title={<span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />Requieren especificaciones de tu parte
            <Badge className="bg-amber-100 text-amber-800 tabular-nums">{pendingSpecDeals.length}</Badge></span>}
          description="Producción necesita más información para partir estos proyectos.">
          <ul className="divide-y divide-slate-100">
            {pendingSpecDeals.map((proj: any) => (
              <li key={proj.id}>
                <Link href={`/leads/${proj.deal_id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{proj.deal?.companies?.name ?? 'Empresa sin nombre'}</p>
                    <p className="text-xs text-slate-500 truncate">Proyecto: {proj.name}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-medium text-accent-700">Completar →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <LeadsTable deals={deals ?? []} teamUsers={canReassign ? (teamUsers ?? []) : []} canReassign={canReassign && canEdit} stages={stages} />
    </PageContainer>
  )
}
