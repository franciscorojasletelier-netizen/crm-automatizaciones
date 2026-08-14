import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'

const WA_API_URL = 'https://graph.facebook.com/v20.0'

export async function POST(request: NextRequest) {
  try {
    let user: any, role: string, rlsSupabase: any
    try {
      ;({ user, role, supabase: rlsSupabase } = await getCurrentProfile())
    } catch {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo roles con acceso comercial pueden enviar
    const allowed = ['super_admin', 'admin', 'gerente', 'comercial']
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { dealId, message } = await request.json()
    if (!dealId || !message?.trim()) {
      return NextResponse.json({ error: 'dealId y message son requeridos' }, { status: 400 })
    }

    // Verificar que el usuario puede ver este deal ANTES de usar el cliente
    // service_role — service_role evade RLS por completo, así que esta
    // validación explícita es la única barrera contra leer/escribir en
    // deals de otra organización.
    const canSee = await canSeeDeal(rlsSupabase, user.id, role, dealId)
    if (!canSee) {
      return NextResponse.json({ error: 'Sin acceso a este deal' }, { status: 403 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    // Obtener el teléfono del contacto del deal
    const { data: deal } = await supabase
      .from('deals')
      .select('id, contacts:primary_contact_id(phone, full_name)')
      .eq('id', dealId)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const phone = (deal.contacts as any)?.phone
    if (!phone) return NextResponse.json({ error: 'El contacto no tiene teléfono registrado' }, { status: 400 })

    // Normalizar número chileno → formato internacional sin +
    const normalized = phone.replace(/\D/g, '')
    const intlPhone = normalized.startsWith('56') ? normalized : `56${normalized}`

    const waToken   = process.env.WHATSAPP_ACCESS_TOKEN
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!waToken || !waPhoneId) {
      return NextResponse.json({ error: 'WhatsApp API no configurada. Faltan variables de entorno.' }, { status: 503 })
    }

    // Enviar mensaje via Meta Cloud API
    const waRes = await fetch(`${WA_API_URL}/${waPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: intlPhone,
        type: 'text',
        text: { body: message.trim() },
      }),
    })

    const waData = await waRes.json()

    if (!waRes.ok) {
      console.error('WhatsApp API error:', waData)
      // Meta rechaza mensajes de texto libre fuera de la ventana de 24h desde
      // el último mensaje del cliente (código 131047) — hace falta una
      // plantilla aprobada. Sin distinguir este caso, el comercial solo ve
      // un error genérico de Meta y no entiende por qué "de repente" no puede escribir.
      const isOutsideWindow = waData?.error?.code === 131047
        || /24.?hour|re-?engagement/i.test(waData?.error?.message ?? '')
      const friendlyError = isOutsideWindow
        ? 'Pasaron más de 24h desde el último mensaje del cliente. WhatsApp solo permite reabrir la conversación con una plantilla aprobada, no con texto libre.'
        : (waData?.error?.message ?? 'Error al enviar por WhatsApp')
      return NextResponse.json(
        { error: friendlyError, outsideWindow: isOutsideWindow },
        { status: 400 }
      )
    }

    const waMessageId = waData?.messages?.[0]?.id ?? null

    // Guardar en base de datos
    const { data: saved, error: dbError } = await supabase
      .from('whatsapp_messages')
      .insert({
        deal_id:       dealId,
        direction:     'outbound',
        body:          message.trim(),
        wa_message_id: waMessageId,
        status:        'sent',
        sent_by:       user.id,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error guardando mensaje:', dbError)
      return NextResponse.json({ error: 'Mensaje enviado pero no se pudo guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: saved })

  } catch (err: any) {
    console.error('Error en /api/whatsapp/send:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
