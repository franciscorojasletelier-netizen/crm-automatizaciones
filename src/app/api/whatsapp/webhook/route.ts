import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim()
  if (!secret || !signature) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// GET — verificación del webhook por Meta
export async function GET(request: NextRequest) {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || 'meta_verify_autopilot_2026'
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

// POST — recibir mensajes entrantes de WhatsApp
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const raw = await request.text()

    // Validar firma de Meta
    if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(raw)

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue

        const value    = change.value
        const messages = value?.messages ?? []
        const contacts = value?.contacts ?? []

        for (const msg of messages) {
          if (msg.type !== 'text') continue  // por ahora solo texto

          const fromPhone   = msg.from          // número del cliente ej: "56991234567"
          const waMessageId = msg.id
          const body        = msg.text?.body ?? ''
          const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()

          // Buscar el contacto por teléfono → encontrar el deal activo
          const normalized = fromPhone.startsWith('56') ? fromPhone : `56${fromPhone}`
          const variants   = [normalized, fromPhone, `+${normalized}`, `+${fromPhone}`]

          const { data: contacts_found } = await supabase
            .from('contacts')
            .select('id')
            .in('phone', variants)
            .limit(1)

          if (!contacts_found?.length) {
            console.log(`WhatsApp: contacto no encontrado para ${fromPhone}`)
            continue
          }

          const contactId = contacts_found[0].id

          // Buscar el deal más reciente activo de ese contacto
          const { data: deals } = await supabase
            .from('deals')
            .select('id')
            .eq('primary_contact_id', contactId)
            .not('stage', 'in', '("cerrado_ganado","cerrado_perdido","no_calificado")')
            .order('created_at', { ascending: false })
            .limit(1)

          if (!deals?.length) {
            console.log(`WhatsApp: no hay deal activo para contacto ${contactId}`)
            continue
          }

          const dealId = deals[0].id

          // Guardar mensaje entrante
          await supabase.from('whatsapp_messages').insert({
            deal_id:       dealId,
            direction:     'inbound',
            body:          body,
            wa_message_id: waMessageId,
            status:        'read',
            created_at:    timestamp,
          })

          // Crear notificación para el dueño del deal
          const { data: deal } = await supabase
            .from('deals')
            .select('owner_id, companies(name)')
            .eq('id', dealId)
            .single()

          if (deal?.owner_id) {
            const contactName = contacts[0]?.profile?.name ?? fromPhone
            await supabase.from('notifications').insert({
              user_id:     deal.owner_id,
              type:        'whatsapp_message',
              title:       `💬 Mensaje WhatsApp de ${contactName}`,
              body:        body.length > 100 ? body.slice(0, 97) + '...' : body,
              entity_type: 'deal',
              entity_id:   dealId,
            })
          }

          console.log(`WhatsApp inbound guardado: deal ${dealId} | msg ${waMessageId}`)
        }
      }
    }

    return NextResponse.json({ status: 'ok' })

  } catch (err: any) {
    console.error('Error en webhook WhatsApp:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
