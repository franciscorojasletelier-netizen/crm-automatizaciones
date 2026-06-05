export const dynamic = 'force-dynamic'
import { createClient, requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye, AlertTriangle } from 'lucide-react'
import LeadsTable from '@/components/leads/leads-table'
import { getVisibleDealIds } from '@/lib/visibility'
import Link from 'next/link'

export default async function LeadsPage() {
  const { role, perms, profile, supabase, user } = await requirePermission('leads')
  const userId = user?.id ?? ''

  // Filtrar por visibilidad según rol
  const visibleIds = await getVisibleDealIds(supabase, userId, role)

  let query = supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action, source,
      created_at, last_contacted_at,
      companies(name, industry),
      contacts:primary_contact_id(full_name, email),
      profiles:owner_id(id, full_name)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  // Si hay filtro de visibilidad, aplicarlo
  if (visibleIds !== null) {
    if (visibleIds.length === 0) {
      // Sin deals asignados
      return (
        <div className="p-4 md:p-6 min-h-full bg-slate-50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Eye className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Sin leads asignados</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Tu gerente aún no te ha asignado ningún lead. Cuando lo haga, aparecerán aquí.
            </p>
          </div>
        </div>
      )
    }
    query = query.in('id', visibleIds)
  }

  const { data: deals } = await query

  // Deals ganados con proyectos pendientes de especificaciones (requieren atención de comercial)
  const { data: pendingSpecDeals } = await supabase
    .from('projects')
    .select('id, name, deal_id, deals(id, companies(name))')
    .eq('status', 'pendiente_especificaciones')
    .not('deal_id', 'is', null)

  const total = deals?.length ?? 0
  const totalValue = deals?.reduce((s, d: any) => s + (Number(d.estimated_value) || 0), 0) ?? 0
  const isFiltered = visibleIds !== null // true = ve solo los suyos
  const canCreate = perms.canCreateLeads

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span><span className="font-semibold text-slate-700">{total}</span> deals {isFiltered ? 'asignados a ti' : 'activos'}</span>
            {totalValue > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span><span className="font-semibold text-slate-700">${totalValue.toLocaleString()}</span> en valor estimado</span>
              </>
            )}
          </div>
        </div>
        {canCreate && (
          <Link href="/leads/nuevo"
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo lead</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        )}
      </div>

      {/* Deals ganados con especificaciones pendientes — requieren atención */}
      {pendingSpecDeals && pendingSpecDeals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Requieren especificaciones de tu parte
            </h2>
            <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
              {pendingSpecDeals.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingSpecDeals.map((proj: any) => (
              <Link key={proj.id} href={`/leads/${proj.deal_id}`}
                className="flex items-center justify-between gap-4 bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-3.5 hover:border-amber-400 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 group-hover:text-amber-800">
                      {proj.deals?.companies?.name ?? 'Empresa sin nombre'}
                    </p>
                    <p className="text-xs text-amber-700">
                      Proyecto: {proj.name} — Producción necesita más información
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-xl border border-amber-300 group-hover:bg-amber-300 transition-colors">
                  Ver deal →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <LeadsTable deals={deals ?? []} />
    </div>
  )
}
