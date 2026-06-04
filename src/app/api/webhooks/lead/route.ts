import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  // Cliente creado dentro del handler para que las env vars estén disponibles
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    // Verificar token de autenticación del webhook
    const authHeader = request.headers.get('authorization')
    const webhookToken = process.env.WEBHOOK_SECRET_TOKEN
    if (webhookToken && authHeader !== `Bearer ${webhookToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await request.json()

    // Campos esperados (todos opcionales excepto company_name o contact_name)
    // Acepta tanto el formato CRM (contact_name, company_name) como el del formulario web (name, company, email, phone)
    const company_name    = body.company_name  ?? body.company ?? null
    const contact_name    = body.contact_name  ?? body.name    ?? null
    const contact_email   = body.contact_email ?? body.email   ?? null
    const contact_phone   = body.contact_phone ?? body.phone   ?? null
    const contact_job_title = body.contact_job_title ?? null
    const industry        = body.industry  ?? null
    const website         = body.website   ?? null
    const source          = body.source    ?? 'Formulario web'
    const estimated_value = body.estimated_value ?? null
    const next_action     = body.next_action ?? null
    const message         = body.message   ?? body.details ?? null

    if (!company_name && !contact_name) {
      return NextResponse.json({ error: 'Se requiere company_name, contact_name, name o company' }, { status: 400 })
    }

    // Crear empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: company_name ?? contact_name, industry, website })
      .select('id').single()

    if (companyError) throw companyError

    // Crear contacto
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        company_id: company.id,
        full_name: contact_name ?? company_name,
        email: contact_email,
        phone: contact_phone,
        job_title: contact_job_title,
      })
      .select('id').single()

    if (contactError) throw contactError

    // Calcular score inicial
    let score = 0
    if (contact_email && !contact_email.includes('gmail') && !contact_email.includes('hotmail')) score += 15
    if (source === 'Meta Ads' || source === 'LinkedIn') score += 10
    if (industry) score += 5

    // Crear deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_id: company.id,
        primary_contact_id: contact.id,
        source,
        estimated_value: estimated_value ? parseFloat(estimated_value) : null,
        next_action: next_action ?? 'Contactar lead entrante',
        score,
        stage: 'nuevo_lead',
        status: 'open',
      })
      .select('id').single()

    if (dealError) throw dealError

    // Registrar mensaje inicial como interacción si viene del formulario
    if (message) {
      await supabase.from('interactions').insert({
        deal_id: deal.id,
        contact_id: contact.id,
        type: 'note',
        direction: 'inbound',
        content: `Mensaje del formulario web:\n${message}`,
      })
    }

    return NextResponse.json({
      success: true,
      lead_id: deal.id,
      company_id: company.id,
      contact_id: contact.id,
    }, { status: 201, headers: CORS_HEADERS })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: 500, headers: CORS_HEADERS })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/webhooks/lead' })
}
