import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Valida la firma HMAC-SHA256 que Meta envía en X-Hub-Signature-256
function verifyMetaSignature(raw: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appSecret) return false           // sin secret configurado → rechazar
  if (!signature) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// GET — verificación del webhook por Meta
export async function GET(request: NextRequest) {
  const VERIFY_TOKEN = (process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'meta_verify_autopilot_2026').trim()
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

// POST — recibir leads de Meta Lead Ads
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim()
  )

  try {
    // Validar firma de Meta sobre el cuerpo crudo antes de procesar
    const raw = await request.text()
    if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(raw)

    const entries = body.entry ?? []

    for (const entry of entries) {
      const changes = entry.changes ?? []

      for (const change of changes) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        const formId    = change.value?.form_id
        const adId      = change.value?.ad_id

        if (!leadgenId) continue

        // Intentar obtener datos del lead desde Meta Graph API
        let fields: Record<string, string> = {}
        let apiSuccess = false

        const accessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim()
        if (accessToken) {
          try {
            const leadRes = await fetch(
              `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`
            )
            const leadData = await leadRes.json()

            if (leadRes.ok && !leadData.error && leadData.field_data) {
              for (const f of leadData.field_data) {
                fields[f.name] = f.values?.[0] ?? ''
              }
              apiSuccess = true
            } else {
              console.log('API Meta no disponible aún, creando lead con datos básicos:', leadData.error?.message)
            }
          } catch (e) {
            console.log('Error llamando API Meta:', e)
          }
        }

        // Datos del lead — desde API si está disponible, o datos mínimos
        const contactName  = fields['full_name'] || fields['nombre'] || fields['name'] || `Lead Meta #${leadgenId.slice(-6)}`
        const contactEmail = fields['email'] || fields['correo'] || null
        const contactPhone = fields['phone_number'] || fields['telefono'] || fields['phone'] || null
        const companyName  = fields['company_name'] || fields['empresa'] || contactName
        const message      = fields['message'] || fields['mensaje'] || null

        // Crear empresa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName })
          .select('id').single()

        if (companyError) { console.error('Error creando empresa:', companyError); continue }

        // Crear contacto
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            company_id: company.id,
            full_name: contactName,
            email: contactEmail,
            phone: contactPhone,
          })
          .select('id').single()

        if (contactError) { console.error('Error creando contacto:', contactError); continue }

        // Score inicial
        let score = 20
        if (contactEmail) score += 10
        if (contactPhone) score += 10

        // Crear deal
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .insert({
            company_id: company.id,
            primary_contact_id: contact.id,
            source: 'Meta Ads',
            next_action: apiSuccess ? 'Contactar lead de Meta Ads' : 'Verificar datos en Meta Business Suite',
            score,
            stage: 'nuevo_lead',
            status: 'open',
          })
          .select('id').single()

        if (dealError) { console.error('Error creando deal:', dealError); continue }

        // Registrar interacción
        const lines = [
          `Lead recibido desde Meta Ads`,
          `Leadgen ID: ${leadgenId}`,
          adId   ? `Ad ID: ${adId}`     : null,
          formId ? `Form ID: ${formId}` : null,
          !apiSuccess ? `⚠️ Datos del formulario no disponibles aún. Ver en Meta Business Suite → Leads Center.` : null,
          message ? `Mensaje: ${message}` : null,
          apiSuccess && Object.keys(fields).length > 0
            ? Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')
            : null,
        ].filter(Boolean).join('\n')

        await supabase.from('interactions').insert({
          deal_id: deal.id,
          contact_id: contact.id,
          type: 'note',
          direction: 'inbound',
          content: lines,
        })

        console.log(`Lead Meta creado: deal ${deal.id} | API: ${apiSuccess}`)
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (error: any) {
    console.error('Error en webhook Meta:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
