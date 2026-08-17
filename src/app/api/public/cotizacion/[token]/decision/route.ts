import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Firma electrónica simple: el cliente escribe su nombre y acepta o
// rechaza. No es un DocuSign — es "aceptar/rechazar con evidencia mínima"
// (nombre tipeado + fecha + IP), suficiente para destrabar una venta B2B
// sin la fricción ni el costo de un proveedor de firma externo.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Endpoint público sin autenticación — freno básico contra abuso/spam.
  const ip = getClientIp(request)
  const { allowed } = await checkRateLimit(supabase, 'quote_decision', ip, { maxHits: 20, windowMinutes: 15 })
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  }

  const body = await request.json()
  const { decision, name } = body as { decision: 'accepted' | 'rejected'; name?: string }
  if (!['accepted', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision inválida' }, { status: 400 })
  }
  if (decision === 'accepted' && !name?.trim()) {
    return NextResponse.json({ error: 'Ingresá tu nombre para aceptar' }, { status: 400 })
  }

  const { data: quote } = await supabase
    .from('quotes').select('id, status').eq('public_token', token).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  if (quote.status !== 'sent') {
    return NextResponse.json({ error: 'Esta cotización ya fue respondida o no está disponible para responder.' }, { status: 409 })
  }

  const updates = decision === 'accepted'
    ? { status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_name: name!.trim(), accepted_ip: ip }
    : { status: 'rejected', rejected_at: new Date().toISOString() }

  const { error } = await supabase.from('quotes').update(updates).eq('id', quote.id)
  if (error) return NextResponse.json({ error: 'No se pudo registrar la respuesta' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
