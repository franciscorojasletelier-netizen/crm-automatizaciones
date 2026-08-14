import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

// Sin fallback: un token público en el repo permitiría verificar un
// endpoint de webhook falso si la env var no está seteada en producción.
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()

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

// Meta puede mandar un batch grande en un solo POST. Procesarlo 100%
// secuencial (fetch a Graph API + 3 inserts + email, uno por uno) arriesga
// el timeout de la función serverless con batches grandes.
const CONCURRENCY = 5

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
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

  if (VERIFY_TOKEN && mode === 'subscribe' && token === VERIFY_TOKEN) {
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

    // La organización se resuelve POR PÁGINA (page_id), no una vez para
    // todo el batch — un mismo POST de Meta puede traer leads de páginas
    // de distintos clientes. Antes, un único WEBHOOK_DEFAULT_ORG_EMAIL
    // mandaba TODOS los leads, de cualquier página, a una sola organización.
    async function resolveOrgForPage(pageId: string | undefined) {
      if (pageId) {
        const { data: integration } = await supabase
          .from('platform_integrations')
          .select('organization_id, access_token')
          .eq('provider', 'meta_leads').eq('external_id', pageId).eq('is_active', true)
          .maybeSingle()
        if (integration?.organization_id) {
          return { orgId: integration.organization_id as string, pageToken: integration.access_token || process.env.META_PAGE_ACCESS_TOKEN }
        }
      }
      // Compatibilidad: página todavía no registrada en platform_integrations
      // — se sostiene el mecanismo anterior para no romper al cliente actual.
      const legacyEmail = process.env.WEBHOOK_DEFAULT_ORG_EMAIL?.trim()
      if (!legacyEmail) return null
      const { data: ownerProfile } = await supabase
        .from('profiles').select('organization_id').eq('email', legacyEmail).maybeSingle()
      const orgId = (ownerProfile as any)?.organization_id ?? null
      return orgId ? { orgId, pageToken: process.env.META_PAGE_ACCESS_TOKEN } : null
    }

    const leadgenChanges = (body.entry ?? [])
      .flatMap((entry: any) => (entry.changes ?? []).map((change: any) => ({ change, entryId: entry.id })))
      .filter((c: any) => c.change.field === 'leadgen')

    await mapWithConcurrency(leadgenChanges, CONCURRENCY, async ({ change, entryId }: any) => {
      {
        const leadData = change.value
        const leadId = leadData.leadgen_id
        const formId = leadData.form_id
        const pageId = leadData.page_id ?? entryId

        console.log('[Meta Webhook] Nuevo lead de Facebook:', { leadId, formId, pageId })

        const resolved = await resolveOrgForPage(pageId)
        if (!resolved) {
          console.error('[Meta Webhook] No se pudo determinar la organización para page_id:', pageId)
          return
        }
        const orgId = resolved.orgId
        const { data: org } = await supabase
          .from('organizations')
          .select('name, display_name, notification_email')
          .eq('id', orgId)
          .maybeSingle()
        const orgDisplayName = org?.display_name || org?.name || 'nuestro equipo'

        // Obtener datos del lead via Graph API — con el token de esta
        // organización si lo configuró, o el global como fallback.
        const pageToken = resolved.pageToken
        if (!pageToken) {
          console.error('[Meta Webhook] Sin access token de Meta configurado para esta página')
          return
        }

        const graphRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadId}?access_token=${pageToken}`
        )
        const leadInfo = await graphRes.json()
        console.log('[Meta Webhook] Datos del lead desde Graph API:', JSON.stringify(leadInfo))

        if (leadInfo.error) {
          console.error('[Meta Webhook] Error al obtener lead:', leadInfo.error)
          return
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
          return
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
          return
        }

        // Crear deal
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .insert({
            company_id: company.id,
            primary_contact_id: contact.id,
            // `stage` omitido: lo asigna el trigger según la organización destino.
            status: 'open',
            source: 'meta_ads',
            next_action: 'Contactar lead de Facebook Ads',
            organization_id: orgId,
          })
          .select('id')
          .single()

        if (dealError) {
          console.error('[Meta Webhook] Error al crear deal:', dealError)
          return
        }

        console.log('[Meta Webhook] Lead creado en CRM:', deal.id)

        // Enviar notificacion por email — solo a la organización dueña del lead
        if (!org?.notification_email) return
        await resend.emails.send({
          from: process.env.EMAIL_FROM?.trim() || `CRM ${orgDisplayName} <onboarding@resend.dev>`,
          to: org.notification_email,
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
    })

    return NextResponse.json({ status: 'ok' }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('[Meta Webhook] Error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500, headers: CORS_HEADERS })
  }
}

