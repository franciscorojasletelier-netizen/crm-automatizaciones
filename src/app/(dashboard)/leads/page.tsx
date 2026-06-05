export const dynamic = 'force-dynamic'
import { createClient, requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye } from 'lucide-react'
import LeadsTable from '@/components/leads/leads-table'
import { getVisibleDealIds } from '@/lib/visibility'

export default async function LeadsPage() {
  const { perms, profile } = await requirePermission('leads')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const role = profile?.role ?? 'soporte'
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

      <LeadsTable deals={deals ?? []} />
    </div>
  )
}
