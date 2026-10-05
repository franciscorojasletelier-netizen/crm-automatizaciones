import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { maskEmail } from '@/lib/quote-acceptance'

// Lectura pública de una cotización por su token — sin sesión, pensado
// para que el cliente final la vea desde el link que le mandaron por
// WhatsApp/email. service_role porque no hay usuario autenticado del CRM.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, status, currency, items, tax_rate, taxes, notes, valid_until, created_at, accepted_at, rejected_at, organization_id, deal_id, payment_terms, payment_conditions, sent_to_email, accepted_by_name, accepted_hash')
    .eq('public_token', token)
    .maybeSingle()

  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  const [{ data: deal }, { data: org }] = await Promise.all([
    supabase.from('deals').select('companies(name, legal_name, tax_id, business_activity, billing_address, billing_email), contacts:primary_contact_id(full_name, email)').eq('id', quote.deal_id).maybeSingle(),
    supabase.from('organizations').select('name, display_name, phone, email, address, logo_url').eq('id', quote.organization_id).maybeSingle(),
  ])

  // Al cliente final no se le exponen ids internos (organización, deal, cotización).
  // Correo al que llegará el código (enmascarado), sin exponerlo completo.
  const knownEmail = quote.sent_to_email || (deal?.contacts as unknown as { email: string | null } | null)?.email || null
  const { id: _id, organization_id: _org, deal_id: _deal, sent_to_email: _sent, ...publicQuote } = quote
  void _id; void _org; void _deal; void _sent
  const contactRow = deal?.contacts as unknown as { full_name: string | null } | null
  const companyRow = deal?.companies as unknown as { name: string | null; legal_name: string | null; tax_id: string | null; business_activity: string | null; billing_address: string | null; billing_email: string | null } | null
  const publicDeal = deal ? { companies: companyRow ? { name: companyRow.name } : null, contacts: contactRow ? { full_name: contactRow.full_name, email: null } : null } : null
  const billing = companyRow ? { legalName: companyRow.legal_name, taxId: companyRow.tax_id, activity: companyRow.business_activity, address: companyRow.billing_address, billingEmail: companyRow.billing_email } : null
  return NextResponse.json({ quote: publicQuote, deal: publicDeal, org, codeTarget: knownEmail ? maskEmail(knownEmail) : null, billing })
}
