import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Phones from test_data_seed_v2.sql
  const updates = [
    { email: 'rsilva@techsolutions.cl',    phone: '+56912345670' },
    { email: 'mgonzalez@distnorte.cl',     phone: '+56987654320' },
    { email: 'projas@clinicabienestar.cl', phone: '+56911223340' },
    { email: 'cfuentes@delsol.cl',         phone: '+56955667780' },
    { email: 'smora@retailexpress.cl',     phone: '+56933445560' },
    { email: 'vparra@agrodelsur.cl',       phone: '+56977889890' },
  ]

  // Debug: get deal contacts
  const { data: deals } = await supabase
    .from('deals')
    .select('id, primary_contact_id, contacts:primary_contact_id(id, full_name, email, phone)')
    .like('id', 'd0000000%')
    .limit(6)

  const results = []
  for (const { email, phone } of updates) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ phone })
      .eq('email', email)
      .select('id, full_name, phone')
    results.push({ email, phone, ok: !error, count: data?.length ?? 0, error: error?.message })
  }

  return NextResponse.json({ deals, results })
}
