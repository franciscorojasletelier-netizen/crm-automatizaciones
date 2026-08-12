export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import OrganizationsTable from '@/components/platform/organizations-table'

export default async function PlataformaPage() {
  const { user, supabase } = await getCurrentProfile()

  const { data: owner } = await supabase
    .from('platform_owners')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!owner) redirect('/dashboard')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, is_active, created_at, profiles(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Organizaciones
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Clientes de la plataforma. Solo visible para el dueño de la plataforma.
            </p>
          </div>
          <Link
            href="/plataforma/nueva-organizacion"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Plus className="w-4 h-4" />
            Nueva organización
          </Link>
        </div>

        <OrganizationsTable organizations={orgs ?? []} />
      </div>
    </div>
  )
}
