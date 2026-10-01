// Datos para cobrar a un cliente: documentos abiertos, contacto, quién
// envía y si tiene correo conectado. Usa el cliente de sesión (RLS).
import type { SupabaseClient } from '@supabase/supabase-js'
import { chileDateString } from '@/lib/dates'
import { INVOICE_SELECT, type Invoice } from '@/lib/cobranza'
import { buildStatement } from '@/lib/cobranza-mensajes'

export async function loadCollectionContext(supabase: SupabaseClient, companyId: string, userId: string, organizationId: string | null) {
  const [invRes, companyRes, contactRes, orgRes, meRes, mailRes] = await Promise.all([
    supabase.from('invoices').select(INVOICE_SELECT).eq('company_id', companyId).in('status', ['pendiente', 'parcial']),
    supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
    // Preferir un contacto con correo; si no, cualquiera.
    supabase.from('contacts').select('full_name, email, phone').eq('company_id', companyId)
      .order('email', { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    organizationId
      ? supabase.from('organizations').select('name, display_name, email, phone, address').eq('id', organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle(),
    supabase.from('email_accounts').select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
  ])

  const org = orgRes.data as { name: string; display_name: string | null; email: string | null; phone: string | null; address: string | null } | null
  const invoices = (invRes.data ?? []) as unknown as Invoice[]
  return {
    company: companyRes.data as { id: string; name: string } | null,
    contact: contactRes.data as { full_name: string | null; email: string | null; phone: string | null } | null,
    invoices,
    statement: buildStatement(invoices, chileDateString()),
    org,
    orgName: org?.display_name || org?.name || null,
    senderName: (meRes.data as { full_name: string | null } | null)?.full_name ?? null,
    hasEmailAccount: !!mailRes.data,
  }
}
