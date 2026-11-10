import type { SupabaseClient } from '@supabase/supabase-js'

// Dominios de correo personal: compartirlos no dice nada sobre la
// empresa del remitente, así que nunca se usan para asociar por dominio
// (si no, todo @gmail.com terminaría en el mismo lead).
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es',
  'live.com', 'live.cl', 'msn.com', 'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com',
  'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'zoho.com',
])

export function emailDomain(address: string): string {
  return address.trim().toLowerCase().split('@')[1] ?? ''
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_DOMAINS.has(domain)
}

/** Escapa los comodines de LIKE para usar un valor literal en ilike. */
function likeLiteral(value: string) {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

export type EmailMatch = {
  contactId: string | null
  dealId: string | null
  /** 'contact': el remitente es un contacto; 'domain': un colega de la misma empresa. */
  matchedBy: 'contact' | 'domain' | null
}

async function latestOpenDeal(
  supabase: SupabaseClient, organizationId: string,
  { contactIds = [], companyIds = [] }: { contactIds?: string[]; companyIds?: string[] }
): Promise<string | null> {
  const filters = [
    contactIds.length ? `primary_contact_id.in.(${contactIds.join(',')})` : '',
    companyIds.length ? `company_id.in.(${companyIds.join(',')})` : '',
  ].filter(Boolean)
  if (!filters.length) return null

  const { data } = await supabase
    .from('deals')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// Asocia un correo a un lead en dos pasos:
//  1. El remitente es un contacto registrado → su deal abierto más
//     reciente (como contacto principal o vía su empresa).
//  2. Si no, el dominio corporativo del remitente (juan@kovacs.cl →
//     kovacs.cl) coincide con el de otros contactos o con el sitio web
//     de una empresa → el deal abierto más reciente de esa empresa.
export async function associateEmailToDeal(
  supabase: SupabaseClient, organizationId: string, counterpartAddress: string
): Promise<EmailMatch> {
  const address = counterpartAddress.trim().toLowerCase()
  if (!address) return { contactId: null, dealId: null, matchedBy: null }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('organization_id', organizationId)
    .ilike('email', likeLiteral(address))
    .limit(5)

  if (contacts?.length) {
    const dealId = await latestOpenDeal(supabase, organizationId, {
      contactIds: contacts.map(c => c.id),
      companyIds: contacts.map(c => c.company_id).filter((id): id is string => !!id),
    })
    return { contactId: contacts[0].id, dealId, matchedBy: 'contact' }
  }

  const domain = emailDomain(address)
  if (!domain || isFreeEmailDomain(domain)) return { contactId: null, dealId: null, matchedBy: null }

  const [{ data: colleagues }, { data: companies }] = await Promise.all([
    supabase.from('contacts').select('id, company_id')
      .eq('organization_id', organizationId)
      .ilike('email', `%@${likeLiteral(domain)}`)
      .limit(50),
    supabase.from('companies').select('id')
      .eq('organization_id', organizationId)
      .ilike('website', `%${likeLiteral(domain)}%`)
      .limit(20),
  ])

  const companyIds = new Set<string>()
  for (const c of colleagues ?? []) if (c.company_id) companyIds.add(c.company_id)
  for (const c of companies ?? []) companyIds.add(c.id)

  const dealId = await latestOpenDeal(supabase, organizationId, {
    contactIds: (colleagues ?? []).map(c => c.id),
    companyIds: Array.from(companyIds),
  })
  return { contactId: null, dealId, matchedBy: dealId ? 'domain' : null }
}
