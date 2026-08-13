export const dynamic = 'force-dynamic'

import { getCurrentProfile } from '@/lib/supabase/server'
import NuevoLeadForm from './NuevoLeadForm'
import { getFieldDefinitions } from '@/lib/fields'

export default async function NuevoLeadPage() {
  const { supabase, organizationId } = await getCurrentProfile()
  const dealFields = await getFieldDefinitions(supabase, 'deal', organizationId ?? undefined)
  return <NuevoLeadForm dealFields={dealFields} />
}
