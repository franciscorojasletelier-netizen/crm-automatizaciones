export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { canSeeDeal } from '@/lib/visibility'
import QuotePrintView from './print-view'
import type { QuoteDeal, QuoteDoc } from '@/lib/quotes'

export default async function QuotePage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await params
  const { user, role, supabase, organizationId } = await getCurrentProfile()

  const hasAccess = await canSeeDeal(supabase, user.id, role, id)
  if (!hasAccess) redirect(`/acceso-denegado?from=/leads/${id}&role=${role}`)

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).eq('deal_id', id).maybeSingle()
  if (!quote) notFound()

  const { data: deal } = await supabase
    .from('deals')
    .select('id, companies(name, industry), contacts:primary_contact_id(full_name, email)')
    .eq('id', id).maybeSingle()

  const { data: org } = organizationId
    ? await supabase.from('organizations').select('name, display_name, phone, email, address').eq('id', organizationId).maybeSingle()
    : { data: null }

  // Relaciones a-uno: sin tipos de base se infieren como arreglo.
  return <QuotePrintView quote={quote as QuoteDoc} deal={deal as unknown as QuoteDeal | null} org={org} dealId={id} />
}
