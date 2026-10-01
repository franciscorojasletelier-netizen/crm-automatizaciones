// Datos para cobrar a un cliente: documentos abiertos, contacto, quién
// envía y si tiene correo conectado. Usa el cliente de sesión (RLS).
import type { SupabaseClient } from '@supabase/supabase-js'
import { chileDateString } from '@/lib/dates'
import { INVOICE_SELECT, type Invoice } from '@/lib/cobranza'
import { buildStatement } from '@/lib/cobranza-mensajes'
import { systemMailAddress, systemMailConfigured } from '@/lib/email/system-mail'

export type OrgInfo = { name: string; display_name: string | null; email: string | null; phone: string | null; address: string | null }

/** Quién envía: nombre del ejecutivo, organización y por dónde sale el correo. */
export async function loadSenderContext(supabase: SupabaseClient, userId: string, organizationId: string | null) {
  const [orgRes, meRes, mailRes] = await Promise.all([
    organizationId
      ? supabase.from('organizations').select('name, display_name, email, phone, address').eq('id', organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle(),
    supabase.from('email_accounts').select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
  ])
  const org = orgRes.data as OrgInfo | null
  return {
    org,
    orgName: org?.display_name || org?.name || null,
    senderName: (meRes.data as { full_name: string | null } | null)?.full_name ?? null,
    // Puede enviar con su cuenta conectada o, si no, con el correo del sistema.
    canSendEmail: !!mailRes.data || systemMailConfigured(),
    /** Remitente cuando NO usa su propia cuenta (null = su cuenta conectada). */
    emailFrom: mailRes.data ? null : systemMailAddress(),
  }
}

export type Contact = { full_name: string | null; email: string | null; phone: string | null }

/** Contacto principal por empresa: prefiere uno con correo y teléfono. */
export async function loadContactsByCompany(supabase: SupabaseClient, companyIds: string[]) {
  const map = new Map<string, Contact>()
  if (companyIds.length === 0) return map
  const { data } = await supabase.from('contacts').select('company_id, full_name, email, phone, created_at')
    .in('company_id', companyIds).order('created_at', { ascending: true })
  const score = (c: Contact) => (c.email ? 2 : 0) + (c.phone ? 1 : 0)
  for (const c of (data ?? []) as (Contact & { company_id: string })[]) {
    const prev = map.get(c.company_id)
    if (!prev || score(c) > score(prev)) map.set(c.company_id, { full_name: c.full_name, email: c.email, phone: c.phone })
  }
  return map
}

export async function loadCollectionContext(supabase: SupabaseClient, companyId: string, userId: string, organizationId: string | null) {
  const [invRes, companyRes, contacts, sender] = await Promise.all([
    supabase.from('invoices').select(INVOICE_SELECT).eq('company_id', companyId).in('status', ['pendiente', 'parcial']),
    supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
    loadContactsByCompany(supabase, [companyId]),
    loadSenderContext(supabase, userId, organizationId),
  ])

  const invoices = (invRes.data ?? []) as unknown as Invoice[]
  return {
    company: companyRes.data as { id: string; name: string } | null,
    contact: contacts.get(companyId) ?? null,
    invoices,
    statement: buildStatement(invoices, chileDateString()),
    ...sender,
  }
}
