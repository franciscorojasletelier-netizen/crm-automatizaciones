export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import NewOrganizationForm from '@/components/platform/new-organization-form'

export default async function NuevaOrganizacionPage() {
  const { user, supabase } = await getCurrentProfile()

  const { data: owner } = await supabase
    .from('platform_owners')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!owner) redirect('/dashboard')

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Nueva organización
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Crea un cliente nuevo con su primer usuario administrador. Solo visible para el dueño de la plataforma.
          </p>
        </div>
        <NewOrganizationForm />
      </div>
    </div>
  )
}
