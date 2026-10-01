// ============================================================
//  Cobranza — tipos y cálculos puros (sin I/O).
//
//  El saldo y el estado guardado los mantiene la base (migración 038).
//  Acá solo se DERIVA lo que depende de "hoy": vencida, días de mora,
//  antigüedad de la deuda y los KPIs del tablero.
// ============================================================
import { chileDateString } from '@/lib/dates'

export type InvoiceStatus = 'pendiente' | 'parcial' | 'pagada' | 'anulada'
export type EffectiveStatus = InvoiceStatus | 'vencida'
export type DocumentType = 'factura' | 'boleta' | 'nota_cobro' | 'otro'
export type PaymentMethod = 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'otro'
export type ActivityKind = 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'compromiso' | 'nota'

export interface Invoice {
  id: string
  invoice_number: number
  company_id: string
  deal_id: string | null
  project_id: string | null
  quote_id: string | null
  document_type: DocumentType
  document_folio: string | null
  description: string
  amount: number
  paid_amount: number
  issue_date: string   // YYYY-MM-DD
  due_date: string     // YYYY-MM-DD
  status: InvoiceStatus
  responsible_id: string | null
  notes: string | null
  next_promise_date: string | null
  last_activity_at: string | null
  cancelled_reason: string | null
  cancelled_at: string | null
  created_at: string
  companies?: { id?: string; name: string } | null
  responsible?: { full_name: string | null } | null
}

export const INVOICE_SELECT = `
  id, invoice_number, company_id, deal_id, project_id, quote_id, document_type, document_folio,
  description, amount, paid_amount, issue_date, due_date, status, responsible_id, notes,
  next_promise_date, last_activity_at, cancelled_reason, cancelled_at, created_at,
  companies(id, name), responsible:responsible_id(full_name)
`

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  factura: 'Factura', boleta: 'Boleta', nota_cobro: 'Nota de cobro', otro: 'Otro',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia', cheque: 'Cheque', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro',
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  llamada: 'Llamada', email: 'Email', whatsapp: 'WhatsApp', reunion: 'Reunión', compromiso: 'Compromiso de pago', nota: 'Nota',
}

export const STATUS_META: Record<EffectiveStatus, { label: string; chip: string; dot: string }> = {
  pendiente: { label: 'Pendiente', chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',       dot: 'bg-slate-400' },
  parcial:   { label: 'Abono parcial', chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',   dot: 'bg-amber-500' },
  vencida:   { label: 'Vencida', chip: 'bg-red-50 text-red-700 ring-1 ring-red-200',               dot: 'bg-red-500' },
  pagada:    { label: 'Pagada', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',    dot: 'bg-emerald-500' },
  anulada:   { label: 'Anulada', chip: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200 line-through', dot: 'bg-slate-300' },
}

const DAY_MS = 86_400_000

/** Días entre dos fechas YYYY-MM-DD (b - a), sin zona horaria de por medio. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

export function balanceOf(inv: Pick<Invoice, 'amount' | 'paid_amount' | 'status'>): number {
  if (inv.status === 'anulada') return 0
  return Math.max(0, Number(inv.amount) - Number(inv.paid_amount))
}

export function isOpen(inv: Pick<Invoice, 'status'>): boolean {
  return inv.status === 'pendiente' || inv.status === 'parcial'
}

/** Días de mora (0 si no está vencida). */
export function daysOverdue(inv: Pick<Invoice, 'status' | 'due_date'>, today = chileDateString()): number {
  if (!isOpen(inv)) return 0
  return Math.max(0, daysBetween(inv.due_date, today))
}

export function effectiveStatus(inv: Pick<Invoice, 'status' | 'due_date'>, today = chileDateString()): EffectiveStatus {
  return daysOverdue(inv, today) > 0 ? 'vencida' : inv.status
}

// ── Antigüedad de la deuda (aging) ─────────────────────────────
export type AgingBucket = 'al_dia' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_mas'

export const AGING_BUCKETS: { key: AgingBucket; label: string; bar: string; text: string }[] = [
  { key: 'al_dia',  label: 'Al día',   bar: 'bg-emerald-500', text: 'text-emerald-700' },
  { key: 'd1_30',   label: '1–30 días',  bar: 'bg-amber-400',   text: 'text-amber-700' },
  { key: 'd31_60',  label: '31–60 días', bar: 'bg-orange-500',  text: 'text-orange-700' },
  { key: 'd61_90',  label: '61–90 días', bar: 'bg-red-500',     text: 'text-red-700' },
  { key: 'd90_mas', label: '+90 días',   bar: 'bg-red-800',     text: 'text-red-900' },
]

export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return 'al_dia'
  if (days <= 30) return 'd1_30'
  if (days <= 60) return 'd31_60'
  if (days <= 90) return 'd61_90'
  return 'd90_mas'
}

export interface CollectionsSummary {
  receivable: number          // saldo total por cobrar
  overdue: number             // saldo vencido
  overdueCount: number
  dueSoon: number             // vence en los próximos 7 días
  dueSoonCount: number
  collectedThisMonth: number
  openCount: number
  weightedDaysOverdue: number // mora promedio ponderada por saldo vencido
  aging: Record<AgingBucket, { amount: number; count: number }>
}

export function summarize(
  invoices: Pick<Invoice, 'amount' | 'paid_amount' | 'status' | 'due_date'>[],
  paymentsThisMonth: { amount: number }[],
  today = chileDateString()
): CollectionsSummary {
  const aging = Object.fromEntries(AGING_BUCKETS.map(b => [b.key, { amount: 0, count: 0 }])) as CollectionsSummary['aging']
  let receivable = 0, overdue = 0, overdueCount = 0, dueSoon = 0, dueSoonCount = 0, openCount = 0, weighted = 0

  for (const inv of invoices) {
    if (!isOpen(inv)) continue
    const balance = balanceOf(inv)
    const late = daysOverdue(inv, today)
    openCount++
    receivable += balance
    const bucket = aging[agingBucket(late)]
    bucket.amount += balance
    bucket.count++
    if (late > 0) {
      overdue += balance
      overdueCount++
      weighted += late * balance
    } else {
      const until = daysBetween(today, inv.due_date)
      if (until <= 7) { dueSoon += balance; dueSoonCount++ }
    }
  }

  return {
    receivable, overdue, overdueCount, dueSoon, dueSoonCount, openCount, aging,
    collectedThisMonth: paymentsThisMonth.reduce((s, p) => s + Number(p.amount), 0),
    weightedDaysOverdue: overdue > 0 ? Math.round(weighted / overdue) : 0,
  }
}

/** Primer día del mes actual en Chile, YYYY-MM-DD. */
export function monthStart(today = chileDateString()): string {
  return `${today.slice(0, 7)}-01`
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function invoiceCode(inv: Pick<Invoice, 'invoice_number'>): string {
  return `COB-${String(inv.invoice_number).padStart(4, '0')}`
}

// ── Cola de cobro del día ─────────────────────────────────────
// Agrupa por cliente (se llama a la empresa, no al documento) y ordena
// por urgencia; dentro de cada nivel, por saldo vencido.

export type QueueReason = 'promesa_hoy' | 'promesa_incumplida' | 'mora_alta' | 'vencido' | 'vence_hoy' | 'por_vencer'

export const QUEUE_REASON: Record<QueueReason, { label: string; tier: number; chip: string }> = {
  promesa_hoy:        { label: 'Compromiso vence hoy',  tier: 6, chip: 'bg-accent-50 text-accent-800 ring-1 ring-accent-200' },
  promesa_incumplida: { label: 'Compromiso incumplido', tier: 5, chip: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  mora_alta:          { label: 'Mora sobre 30 días',    tier: 4, chip: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  vencido:            { label: 'Vencido',               tier: 3, chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
  vence_hoy:          { label: 'Vence hoy',             tier: 2, chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
  por_vencer:         { label: 'Vence pronto',          tier: 1, chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
}

export interface QueueItem {
  companyId: string
  companyName: string
  reason: QueueReason
  balance: number
  overdue: number
  maxDaysLate: number
  documents: number
  /** Documento que motiva el cobro (para abrir su ficha). */
  leadInvoiceId: string
  promiseDate: string | null
  lastActivityAt: string | null
  handledToday: boolean
}

export function buildCollectionQueue(invoices: Invoice[], today: string, soonDays = 3): QueueItem[] {
  const byCompany = new Map<string, Invoice[]>()
  for (const inv of invoices) {
    if (!isOpen(inv) || balanceOf(inv) <= 0) continue
    const list = byCompany.get(inv.company_id) ?? []
    list.push(inv)
    byCompany.set(inv.company_id, list)
  }

  const items: QueueItem[] = []
  for (const [companyId, list] of byCompany) {
    const candidates: { reason: QueueReason; inv: Invoice }[] = []
    for (const inv of list) {
      const late = daysOverdue(inv, today)
      const until = daysBetween(today, inv.due_date)
      if (inv.next_promise_date === today) candidates.push({ reason: 'promesa_hoy', inv })
      else if (inv.next_promise_date && inv.next_promise_date < today) candidates.push({ reason: 'promesa_incumplida', inv })
      if (late > 30) candidates.push({ reason: 'mora_alta', inv })
      else if (late > 0) candidates.push({ reason: 'vencido', inv })
      else if (until === 0) candidates.push({ reason: 'vence_hoy', inv })
      else if (until > 0 && until <= soonDays) candidates.push({ reason: 'por_vencer', inv })
    }
    if (candidates.length === 0) continue
    const top = candidates.reduce((best, c) => QUEUE_REASON[c.reason].tier > QUEUE_REASON[best.reason].tier ? c : best)

    const lastActivityAt = list.map(i => i.last_activity_at).filter(Boolean).sort().at(-1) ?? null
    items.push({
      companyId,
      companyName: list[0].companies?.name ?? 'Cliente',
      reason: top.reason,
      balance: list.reduce((s, i) => s + balanceOf(i), 0),
      overdue: list.filter(i => daysOverdue(i, today) > 0).reduce((s, i) => s + balanceOf(i), 0),
      maxDaysLate: Math.max(0, ...list.map(i => daysOverdue(i, today))),
      documents: list.length,
      leadInvoiceId: top.inv.id,
      promiseDate: list.map(i => i.next_promise_date).filter(Boolean).sort()[0] ?? null,
      lastActivityAt,
      handledToday: !!lastActivityAt && chileDateString(new Date(lastActivityAt)) === today,
    })
  }

  return items.sort((a, b) =>
    Number(a.handledToday) - Number(b.handledToday)
    || QUEUE_REASON[b.reason].tier - QUEUE_REASON[a.reason].tier
    || b.overdue - a.overdue
    || b.balance - a.balance)
}
