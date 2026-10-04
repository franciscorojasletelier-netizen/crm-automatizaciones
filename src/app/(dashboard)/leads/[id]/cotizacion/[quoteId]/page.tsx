export const dynamic = 'force-dynamic'
import { getCurrentProfile } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { canSeeDeal } from '@/lib/visibility'
import { canEditSection } from '@/lib/roles'
import QuotePrintView from './print-view'
import type { QuoteDeal, QuoteDoc } from '@/lib/quotes'

export default async function QuotePage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await params
  const { user, role, sectionAccess, supabase, organizationId, profile } = await getCurrentProfile()

  const hasAccess = await canSeeDeal(supabase, user.id, role, id)
  if (!hasAccess) redirect(`/acceso-denegado?from=/leads/${id}&role=${role}`)

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).eq('deal_id', id).maybeSingle()
  if (!quote) notFound()

  const { data: deal } = await supabase
    .from('deals')
    .select('id, companies(name, industry), contacts:primary_contact_id(full_name, email)')
    .eq('id', id).maybeSingle()

  const { data: org } = organizationId
    ? await supabase.from('organizations').select('name, display_name, phone, email, address, logo_url').eq('id', organizationId).maybeSingle()
    : { data: null }

  // Mismo criterio que el panel de cotizaciones de la ficha del lead.
  const canEdit = ['super_admin', 'gerente', 'comercial'].includes(role) && canEditSection(role, sectionAccess, 'leads')

  // Relaciones a-uno: sin tipos de base se infieren como arreglo.
  return <QuotePrintView quote={{ ...(quote as QuoteDoc), id: quote.id }} deal={deal as unknown as QuoteDeal | null} org={org} dealId={id} canEdit={canEdit} senderName={profile?.full_name ?? null} />
}
