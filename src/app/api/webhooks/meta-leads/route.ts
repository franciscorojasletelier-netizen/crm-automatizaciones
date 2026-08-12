import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'meta_verify_autopilot_2026'

function verifyMetaSignature(raw: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appSecret || !signature) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Verificacion del webhook (GET) - Meta llama esto para confirmar el endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verificacion exitosa')
    return new NextResponse(challenge, { status: 200, headers: CORS_HEADERS })
  }

  console.error('[Meta Webhook] Token de verificacion invalido:', token)
  return new NextResponse('Forbidden', { status: 403, headers: CORS_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Recepcion de leads (POST)
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401, headers: CORS_HEADERS })
    }
    const body = JSON.parse(raw)
    console.log('[Meta Webhook] Payload recibido:', JSON.stringify(body, null, 2))

    // Meta envia: { object: "page", entry: [{ id, time, changes: [{ field: "leadgen", value: { ... } }] }] }
    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ignored' }, { headers: CORS_HEADERS })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SECRET_KEY!.trim()
    )
    const resend = new Resend(process.env.RESEND_API_KEY)

    // service_role evade RLS — sin sesión de usuario, hay que resolver
    // la organización destino explícitamente. Fase 1: una sola
    // organización real, identificada por el email de contacto interno.
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('email', 'autopilotspa@gmail.com')
      .maybeSingle()
    const orgId = (ownerProfile as any)?.organization_id ?? null
    if (!orgId) {
      return NextResponse.json({ error: 'No se pudo determinar la organización destino' }, { status: 500, headers: CORS_HEADERS })
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue

        const leadData = change.value
        const leadId = leadData.leadgen_id
        const formId = leadData.form_id
        const pageId = leadData.page_id

        console.log('[Meta Webhook] Nuevo lead de Facebook:', { leadId, formId, pageId })

        // Obtener datos del lead via Graph API
        const pageToken = process.env.META_PAGE_ACCESS_TOKEN
        if (!pageToken) {
          console.error('[Meta Webhook] META_PAGE_ACCESS_TOKEN no configurado')
          continue
        }

        const graphRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadId}?access_token=${pageToken}`
        )
        const leadInfo = await graphRes.json()
        console.log('[Meta Webhook] Datos del lead desde Graph API:', JSON.stringify(leadInfo))

        if (leadInfo.error) {
          console.error('[Meta Webhook] Error al obtener lead:', leadInfo.error)
          continue
        }

        // Parsear campos del formulario
        const fields: Record<string, string> = {}
        for (const f of leadInfo.field_data ?? []) {
          fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values
        }

        const contact_name = fields['full_name'] ?? fields['nombre'] ?? fields['name'] ?? 'Sin nombre'
        const email = fields['email'] ?? fields['correo'] ?? null
        const phone = fields['phone_number'] ?? fields['telefono'] ?? fields['phone'] ?? null
        const company_name = fields['company_name'] ?? fields['empresa'] ?? 'Lead Facebook'

        console.log('[Meta Webhook] Datos parseados:', { contact_name, email, phone, company_name })

        // Crear empresa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ name: company_name, industry: 'Sin definir', organization_id: orgId })
          .select('id')
          .single()

        if (companyError) {
          console.error('[Meta Webhook] Error al crear empresa:', companyError)
          continue
        }

        // Crear contacto
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            company_id: company.id,
            full_name: contact_name,
            email,
            phone,
            organization_id: orgId,
          })
          .select('id')
          .single()

        if (contactError) {
          console.error('[Meta Webhook] Error al crear contacto:', contactError)
          continue
        }

        // Crear deal
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .insert({
            company_id: company.id,
            primary_contact_id: contact.id,
            stage: 'nuevo_lead',
            status: 'open',
            source: 'meta_ads',
            next_action: 'Contactar lead de Facebook Ads',
            organization_id: orgId,
          })
          .select('id')
          .single()

        if (dealError) {
          console.error('[Meta Webhook] Error al crear deal:', dealError)
          continue
        }

        console.log('[Meta Webhook] Lead creado en CRM:', deal.id)

        // Enviar notificacion por email
        await resend.emails.send({
          from: process.env.EMAIL_FROM?.trim() || 'Autopilot CRM <onboarding@resend.dev>',
          to: 'autopilotspa@gmail.com',
          subject: `Nuevo lead de Facebook Ads: ${contact_name}`,
          html: `
            <h2>Nuevo lead desde Facebook Ads</h2>
            <table style="border-collapse:collapse;width:100%;max-width:500px">
              <tr><td style="padding:8px;color:#666">Nombre</td><td style="padding:8px;font-weight:bold">${contact_name}</td></tr>
              ${email ? `<tr><td style="padding:8px;color:#666">Email</td><td style="padding:8px">${email}</td></tr>` : ''}
              ${phone ? `<tr><td style="padding:8px;color:#666">Telefono</td><td style="padding:8px">${phone}</td></tr>` : ''}
              <tr><td style="padding:8px;color:#666">Empresa</td><td style="padding:8px">${company_name}</td></tr>
              <tr><td style="padding:8px;color:#666">Fuente</td><td style="padding:8px">Facebook Ads (Lead Form)</td></tr>
            </table>
            <br>
            <a href="https://crm-automatizaciones.vercel.app/leads/${deal.id}"
               style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
              Ver en CRM
            </a>
          `,
        })
      }
    }

    return NextResponse.json({ status: 'ok' }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('[Meta Webhook] Error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500, headers: CORS_HEADERS })
  }
}

