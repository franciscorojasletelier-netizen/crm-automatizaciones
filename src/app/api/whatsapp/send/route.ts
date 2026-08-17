import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'
import { sendWhatsAppText } from '@/lib/whatsapp'

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
      .select('id, organization_id, contacts:primary_contact_id(phone, full_name)')
      .eq('id', dealId)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const phone = (deal.contacts as any)?.phone
    if (!phone) return NextResponse.json({ error: 'El contacto no tiene teléfono registrado' }, { status: 400 })

    const result = await sendWhatsAppText(supabase, {
      organizationId: deal.organization_id, dealId, phone, body: message.trim(), sentBy: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, outsideWindow: result.outsideWindow }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: result.message })

  } catch (err: any) {
    console.error('Error en /api/whatsapp/send:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
