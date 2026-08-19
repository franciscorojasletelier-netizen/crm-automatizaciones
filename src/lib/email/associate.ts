import type { SupabaseClient } from '@supabase/supabase-js'

// Mismo espíritu que la asociación de whatsapp/webhook/route.ts
// (contacto → deal abierto más reciente), pero por email en vez de
// teléfono, y SIN descartar el mensaje si no hay match — a diferencia
// de WhatsApp, acá se guarda igual con deal_id/contact_id nulos, para
// no perder correspondencia que después alguien pueda enlazar a mano.
export async function associateEmailToDeal(
  supabase: SupabaseClient, organizationId: string, counterpartAddress: string
): Promise<{ contactId: string | null; dealId: string | null }> {
  const address = counterpartAddress.trim().toLowerCase()
  if (!address) return { contactId: null, dealId: null }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('email', address)
    .maybeSingle()

  if (!contact) return { contactId: null, dealId: null }

  const { data: deal } = await supabase
    .from('deals')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('primary_contact_id', contact.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { contactId: contact.id, dealId: deal?.id ?? null }
}
