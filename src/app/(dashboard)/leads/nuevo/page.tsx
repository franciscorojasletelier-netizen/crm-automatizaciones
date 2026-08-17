export const dynamic = 'force-dynamic'

import { getCurrentProfile } from '@/lib/supabase/server'
import NuevoLeadForm from './NuevoLeadForm'
import { getFieldDefinitions } from '@/lib/fields'
import { getPipelines, defaultPipeline } from '@/lib/stages'

export default async function NuevoLeadPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const { pipeline: pipelineParam } = await searchParams
  const { supabase, organizationId } = await getCurrentProfile()
  const dealFields = await getFieldDefinitions(supabase, 'deal', organizationId ?? undefined)
  const pipelines = await getPipelines(supabase, organizationId ?? undefined)
  const initialPipelineId = (pipelineParam && pipelines.find(p => p.id === pipelineParam)?.id) || defaultPipeline(pipelines)?.id || ''
  return <NuevoLeadForm dealFields={dealFields} pipelines={pipelines} initialPipelineId={initialPipelineId} />
}
