export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { getAllStages } from '@/lib/stages'
import { getFieldDefinitions, type FieldEntity } from '@/lib/fields'
import { NAV_SECTIONS } from '@/lib/roles'
import StagesEditor from '@/components/platform/stages-editor'
import FieldsEditor from '@/components/platform/fields-editor'
import ModulesEditor from '@/components/platform/modules-editor'
import UserLimitEditor from '@/components/platform/user-limit-editor'

export default async function OrganizationConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getCurrentProfile()

  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) redirect('/dashboard')

  const { data: org } = await supabase
    .from('organizations').select('id, name, is_active, max_users').eq('id', id).maybeSingle()
  if (!org) notFound()

  const [stages, dealFields, companyFields, contactFields, modulesRes, usersRes] = await Promise.all([
    getAllStages(supabase, id),
    getFieldDefinitions(supabase, 'deal', id),
    getFieldDefinitions(supabase, 'company', id),
    getFieldDefinitions(supabase, 'contact', id),
    supabase.from('organization_modules').select('module_key, enabled').eq('organization_id', id),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', id),
  ])

  const enabledByKey: Record<string, boolean> = {}
  for (const row of modulesRes.data ?? []) enabledByKey[row.module_key] = row.enabled

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/plataforma" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" /> Volver a organizaciones
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            {org.name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configuración de embudo, campos y módulos — solo visible para el dueño de la plataforma.
          </p>
        </div>

        <UserLimitEditor orgId={org.id} currentUsers={usersRes.count ?? 0} maxUsers={org.max_users} />

        <StagesEditor orgId={org.id} stages={stages} />

        <FieldsEditor orgId={org.id} entity="deal" label="Campos de Leads / Deals" fields={dealFields} />
        <FieldsEditor orgId={org.id} entity="company" label="Campos de Empresas" fields={companyFields} />
        <FieldsEditor orgId={org.id} entity="contact" label="Campos de Contactos" fields={contactFields} />

        <ModulesEditor orgId={org.id} sections={NAV_SECTIONS} enabledByKey={enabledByKey} />
      </div>
    </div>
  )
}
