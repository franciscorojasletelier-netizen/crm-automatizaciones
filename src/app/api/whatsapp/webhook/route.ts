import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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
  // Sin fallback: un token público en el repo permitiría verificar un
  // endpoint de webhook falso si la env var no está seteada en producción.
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (VERIFY_TOKEN && mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
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

        // El número de WhatsApp Business que RECIBIÓ el mensaje identifica
        // a la organización — antes se buscaba el contacto por teléfono a
        // nivel global, sin filtrar por organización: si dos organizaciones
        // tenían contactos con el mismo número, un mensaje podía cruzarse.
        const phoneNumberId = value?.metadata?.phone_number_id as string | undefined
        let waOrgId: string | null = null
        if (phoneNumberId) {
          const { data: integration } = await supabase
            .from('platform_integrations')
            .select('organization_id')
            .eq('provider', 'whatsapp').eq('external_id', phoneNumberId).eq('is_active', true)
            .maybeSingle()
          waOrgId = integration?.organization_id ?? null
        }
        // Compatibilidad: número todavía no registrado — no se filtra por
        // organización, mismo comportamiento que antes de este cambio.

        for (const msg of messages) {
          // No se descargan ni renderizan adjuntos todavía, pero antes un
          // mensaje no-texto (foto de comprobante, audio, documento — muy
          // común) desaparecía sin dejar rastro: el vendedor nunca se
          // enteraba de que algo había llegado. Ahora queda un placeholder
          // visible en el chat/timeline en vez de perderse en silencio.
          const NON_TEXT_LABELS: Record<string, string> = {
            image: '📷 Imagen recibida (no se muestra en el CRM todavía — revisar en WhatsApp)',
            audio: '🎤 Audio recibido (no se reproduce en el CRM todavía — revisar en WhatsApp)',
            video: '🎬 Video recibido (no se muestra en el CRM todavía — revisar en WhatsApp)',
            document: `📄 Documento recibido${msg.document?.filename ? `: ${msg.document.filename}` : ''} (revisar en WhatsApp)`,
            location: '📍 Ubicación compartida (revisar en WhatsApp)',
            sticker: '💬 Sticker recibido',
          }
          if (msg.type !== 'text' && !NON_TEXT_LABELS[msg.type]) {
            console.log(`WhatsApp: tipo de mensaje no soportado (${msg.type}), se ignora`)
            continue
          }

          const fromPhone   = msg.from          // número del cliente ej: "56991234567"
          const waMessageId = msg.id
          const body        = msg.type === 'text' ? (msg.text?.body ?? '') : NON_TEXT_LABELS[msg.type]
          const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()

          // Buscar el contacto por teléfono → encontrar el deal activo
          // phone_digits (migración 065) guarda solo dígitos, así calza aunque
          // el teléfono se haya escrito con espacios, guiones o sin el 56.
          const digits   = String(fromPhone).replace(/\D/g, '')
          const local    = digits.startsWith('56') ? digits.slice(2) : digits
          const variants = [...new Set([digits, `56${local}`, local])]

          let contactQuery = supabase.from('contacts').select('id').in('phone_digits', variants)
          if (waOrgId) contactQuery = contactQuery.eq('organization_id', waOrgId)
          const { data: contacts_found } = await contactQuery.limit(20)

          if (!contacts_found?.length) {
            console.log(`WhatsApp: contacto no encontrado para …${String(fromPhone).slice(-4)}`)
            continue
          }

          // El mismo número puede estar en varios contactos (un cliente con
          // más de un negocio). Se prefiere un negocio abierto; si no hay, el
          // más reciente no eliminado — así un cliente que ya compró y vuelve
          // a escribir no se pierde.
          const { data: deals } = await supabase
            .from('deals')
            .select('id, status')
            .in('primary_contact_id', contacts_found.map(c => c.id))
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20)

          const chosen = deals?.find(d => d.status === 'open') ?? deals?.[0]
          if (!chosen) {
            console.log(`WhatsApp: sin negocio para …${String(fromPhone).slice(-4)}`)
            continue
          }

          const dealId = chosen.id

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

  } catch (err) {
    console.error('Error en webhook WhatsApp:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
