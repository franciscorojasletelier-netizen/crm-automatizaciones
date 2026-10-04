export const dynamic = 'force-dynamic'

import { getCurrentProfile } from '@/lib/supabase/server'
import NuevoLeadForm from './NuevoLeadForm'
import { getFieldDefinitions } from '@/lib/fields'
import { getPipelines, defaultPipeline } from '@/lib/stages'

export default async function NuevoLeadPage({ searchParams }: { searchParams: Promise<{ pipeline?: string; empresa?: string }> }) {
  const { pipeline: pipelineParam, empresa } = await searchParams
  const { supabase, organizationId } = await getCurrentProfile()
  const dealFields = await getFieldDefinitions(supabase, 'deal', organizationId ?? undefined)
  const pipelines = await getPipelines(supabase, organizationId ?? undefined)
  const initialPipelineId = (pipelineParam && pipelines.find(p => p.id === pipelineParam)?.id) || defaultPipeline(pipelines)?.id || ''
  // Desde la ficha de una empresa: el negocio nuevo queda en esa empresa.
  const { data: initialCompany } = empresa && /^[0-9a-f-]{36}$/i.test(empresa)
    ? await supabase.from('companies').select('id, name, industry, website').eq('id', empresa).maybeSingle()
    : { data: null }
  return <NuevoLeadForm dealFields={dealFields} pipelines={pipelines} initialPipelineId={initialPipelineId} initialCompany={initialCompany} />
}
