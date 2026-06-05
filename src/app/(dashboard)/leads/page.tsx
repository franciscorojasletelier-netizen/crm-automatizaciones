export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import LeadsTable from '@/components/leads/leads-table'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action, source,
      created_at, last_contacted_at,
      companies(name, industry),
      contacts:primary_contact_id(full_name, email),
      profiles:owner_id(full_name)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const total = deals?.length ?? 0
  const totalValue = deals?.reduce((s, d: any) => s + (Number(d.estimated_value) || 0), 0) ?? 0

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span><span className="font-semibold text-slate-700">{total}</span> deals activos</span>
            {totalValue > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span><span className="font-semibold text-slate-700">${totalValue.toLocaleString()}</span> en valor estimado</span>
              </>
            )}
          </div>
        </div>
        <Link href="/leads/nuevo"
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo lead</span>
          <span className="sm:hidden">Nuevo</span>
        </Link>
      </div>

      <LeadsTable deals={deals ?? []} />
    </div>
  )
}
