import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'meta_verify_autopilot_2026'

// GET — verificación del webhook por Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Meta webhook verificado correctamente')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

// POST — recibir leads de Meta Lead Ads
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const body = await request.json()
    console.log('Meta webhook recibido:', JSON.stringify(body, null, 2))

    // Meta envía array de entries
    const entries = body.entry ?? []

    for (const entry of entries) {
      const changes = entry.changes ?? []

      for (const change of changes) {
        if (change.field !== 'leadgen') continue

        const leadgenId  = change.value?.leadgen_id
        const pageId     = change.value?.page_id
        const formId     = change.value?.form_id
        const adId       = change.value?.ad_id

        if (!leadgenId) continue

        // Obtener datos del lead desde Meta Graph API
        const appSecret = process.env.META_APP_SECRET
        const accessToken = process.env.META_PAGE_ACCESS_TOKEN

        if (!accessToken) {
          console.error('META_PAGE_ACCESS_TOKEN no configurado')
          continue
        }

        const leadRes = await fetch(
          `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`
        )
        const leadData = await leadRes.json()

        if (!leadRes.ok || leadData.error) {
          console.error('Error obteniendo lead de Meta:', leadData.error)
          continue
        }

        // Extraer campos del formulario
        const fields: Record<string, string> = {}
        for (const f of leadData.field_data ?? []) {
          fields[f.name] = f.values?.[0] ?? ''
        }

        const contactName  = fields['full_name'] || fields['nombre'] || fields['name'] || 'Lead de Meta'
        const contactEmail = fields['email'] || fields['correo'] || null
        const contactPhone = fields['phone_number'] || fields['telefono'] || fields['phone'] || null
        const companyName  = fields['company_name'] || fields['empresa'] || contactName
        const message      = fields['message'] || fields['mensaje'] || null

        // Crear empresa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName, industry: null })
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

        // Score inicial — Meta Ads tiene alta intención
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
            next_action: 'Contactar lead de Meta Ads',
            score,
            stage: 'nuevo_lead',
            status: 'open',
          })
          .select('id').single()

        if (dealError) { console.error('Error creando deal:', dealError); continue }

        // Registrar interacción con info del formulario
        const interactionContent = [
          `Lead recibido desde Meta Ads`,
          adId  ? `Ad ID: ${adId}`   : null,
          formId ? `Form ID: ${formId}` : null,
          message ? `Mensaje: ${message}` : null,
          Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n'),
        ].filter(Boolean).join('\n')

        await supabase.from('interactions').insert({
          deal_id: deal.id,
          contact_id: contact.id,
          type: 'note',
          direction: 'inbound',
          content: interactionContent,
        })

        console.log(`Lead de Meta creado: deal ${deal.id}, contacto: ${contactName}`)
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (error: any) {
    console.error('Error en webhook Meta:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
