import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    .select('id, quote_number, status, currency, items, tax_rate, notes, valid_until, created_at, accepted_at, rejected_at, organization_id, deal_id')
    .eq('public_token', token)
    .maybeSingle()

  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  const [{ data: deal }, { data: org }] = await Promise.all([
    supabase.from('deals').select('companies(name), contacts:primary_contact_id(full_name, email)').eq('id', quote.deal_id).maybeSingle(),
    supabase.from('organizations').select('name, display_name, phone, email, address').eq('id', quote.organization_id).maybeSingle(),
  ])

  return NextResponse.json({ quote, deal, org })
}
