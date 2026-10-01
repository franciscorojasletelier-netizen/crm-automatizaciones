import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chileDateString } from '@/lib/dates'
import { addDays, balanceOf, invoiceCode } from '@/lib/cobranza'
import { formatCLP } from '@/lib/format'
import { notifyServiceExpirations } from '@/lib/service-checks'

// Cron diario de cobranza (pg_cron 12:30 UTC, migración 038).
// Avisa en la app, a quien corresponde, de dos hechos del día:
//  - documentos que vencieron AYER (el primer día de mora, no todos los
//    días de mora: el tablero ya muestra la cartera vencida completa);
//  - compromisos de pago que vencen HOY.
// Destinatario: el responsable del documento; sin responsable, quienes
// gestionan cobranza en la organización (gerencia + finanzas).
const COLLECTION_ROLES = ['super_admin', 'admin', 'gerente', 'finanzas']

type Row = {
  id: string; invoice_number: number; organization_id: string; responsible_id: string | null
  amount: number; paid_amount: number; status: 'pendiente' | 'parcial' | 'pagada' | 'anulada'
  due_date: string; next_promise_date: string | null; companies: { name: string } | null
}

export async function GET(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = chileDateString()
  const yesterday = addDays(today, -1)
  const select = 'id, invoice_number, organization_id, responsible_id, amount, paid_amount, status, due_date, next_promise_date, companies(name)'

  const [{ data: newlyOverdue, error: e1 }, { data: promisesToday, error: e2 }] = await Promise.all([
    supabase.from('invoices').select(select).in('status', ['pendiente', 'parcial']).eq('due_date', yesterday),
    supabase.from('invoices').select(select).in('status', ['pendiente', 'parcial']).eq('next_promise_date', today),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })

  const rows = [...(newlyOverdue ?? []), ...(promisesToday ?? [])] as unknown as Row[]
  const orgIds = [...new Set(rows.filter(r => !r.responsible_id).map(r => r.organization_id))]
  const managersByOrg = new Map<string, string[]>()
  if (orgIds.length) {
    const { data: managers } = await supabase.from('profiles')
      .select('id, organization_id').in('organization_id', orgIds).in('role', COLLECTION_ROLES).eq('is_active', true)
    for (const m of managers ?? []) {
      managersByOrg.set(m.organization_id, [...(managersByOrg.get(m.organization_id) ?? []), m.id])
    }
  }

  const recipients = (r: Row) => r.responsible_id ? [r.responsible_id] : (managersByOrg.get(r.organization_id) ?? [])
  const notifications = [
    ...((newlyOverdue ?? []) as unknown as Row[]).flatMap(r => recipients(r).map(user_id => ({
      user_id, type: 'automation', entity_type: 'invoice', entity_id: r.id,
      title: `⏰ Venció ${invoiceCode(r)} · ${r.companies?.name ?? 'Cliente'}`,
      body: `Saldo pendiente ${formatCLP(balanceOf(r))}. Registra una gestión de cobranza.`,
    }))),
    ...((promisesToday ?? []) as unknown as Row[]).flatMap(r => recipients(r).map(user_id => ({
      user_id, type: 'automation', entity_type: 'invoice', entity_id: r.id,
      title: `🤝 Hoy vence un compromiso de pago · ${r.companies?.name ?? 'Cliente'}`,
      body: `${invoiceCode(r)} — saldo ${formatCLP(balanceOf(r))}. Confirma si se pagó.`,
    }))),
  ]

  if (notifications.length) {
    const { error } = await supabase.from('notifications').insert(notifications)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Vencimientos de servicios (plataforma): nunca debe tumbar la cobranza.
  let serviceAlerts = 0
  try { serviceAlerts = await notifyServiceExpirations(supabase) } catch (e) { console.error('service checks', e) }

  return NextResponse.json({
    status: 'ok', newlyOverdue: newlyOverdue?.length ?? 0, promisesToday: promisesToday?.length ?? 0, notified: notifications.length, serviceAlerts,
  })
}

// pg_cron (cron_call) invoca con POST; GET queda para pruebas manuales.
export const POST = GET
