// Envía una solicitud de factura a un correo (contador externo) desde la ficha del negocio.
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'
import { emailServiceClient } from '@/lib/email/send-as-user'
import { sendBillingRequestTo, type BillingRequestRow } from '@/lib/billing'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof getCurrentProfile>>
  try { ctx = await getCurrentProfile() } catch { return NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { user, role, supabase, profile } = ctx
  const body = await request.json().catch(() => ({}))
  const to = String(body.to ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Correo no válido' }, { status: 400 })

  // Con el cliente de sesión: la RLS solo deja ver las de su organización.
  const { data: req } = await supabase.from('billing_requests')
    .select('id, organization_id, deal_id, quote_id, task_id, installment, installments, label, amount, currency, status')
    .eq('id', String(body.requestId ?? '')).maybeSingle()
  if (!req) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (req.deal_id && !(await canSeeDeal(supabase, user.id, role, req.deal_id))) return NextResponse.json({ error: 'Sin acceso a este negocio' }, { status: 403 })

  const res = await sendBillingRequestTo(emailServiceClient(), req as BillingRequestRow, to, profile?.email ?? null)
  if (!res.ok) return NextResponse.json({ error: res.error ?? 'No se pudo enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
