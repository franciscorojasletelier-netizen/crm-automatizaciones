export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
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

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{deals?.length ?? 0} deals activos</p>
        </div>
        <Link
          href="/leads/nuevo"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo lead</span>
          <span className="sm:hidden">Nuevo</span>
        </Link>
      </div>

      <LeadsTable deals={deals ?? []} />
    </div>
  )
}

