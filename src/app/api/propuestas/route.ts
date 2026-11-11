// Sirve propuestas desde el bucket PRIVADo con URL firmada,
// validando que el usuario tenga acceso al deal.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const dealId = req.nextUrl.searchParams.get('deal')
  if (!dealId) return NextResponse.json({ error: 'Falta deal' }, { status: 400 })

  // Rol para la verificación de visibilidad
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'soporte'

  const allowed = await canSeeDeal(supabase, user.id, role, dealId)
  if (!allowed) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: deal } = await supabase
    .from('deals').select('proposal_url').eq('id', dealId).single()
  const stored: string | null = deal?.proposal_url ?? null
  if (!stored) return NextResponse.json({ error: 'Sin propuesta' }, { status: 404 })

  // Compatibilidad: propuestas antiguas guardaron la URL pública completa
  // Solo si apunta al Storage de este proyecto: proposal_url es editable y
  // un valor arbitrario convertía este endpoint en una redirección abierta
  // (un enlace del CRM que lleva a un sitio de phishing).
  if (stored.startsWith('http')) {
    let sameStorage = false
    try {
      sameStorage = new URL(stored).host === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host
    } catch { /* URL inválida */ }
    if (!sameStorage) return NextResponse.json({ error: 'Enlace de propuesta no válido' }, { status: 400 })
    return NextResponse.redirect(stored)
  }

  // Nuevas: el valor es el path dentro del bucket → URL firmada (1h)
  const { data: signed, error } = await supabase.storage
    .from('propuestas').createSignedUrl(stored, 60 * 60)
  if (error || !signed) {
    return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 })
  }
  return NextResponse.redirect(signed.signedUrl)
}
