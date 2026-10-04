// Monedas e impuestos del CRM.
//
// La organización tiene una moneda base (organizations.currency) con la que
// se muestran deals, pipeline, reportes y cobranza; una cotización puede ir
// en otra. CLP no usa decimales; USD y EUR, dos.

export type Currency = 'CLP' | 'USD' | 'EUR'

export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'CLP', label: 'Peso chileno (CLP)' },
  { code: 'USD', label: 'Dólar estadounidense (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
]

export function normalizeCurrency(c: string | null | undefined): Currency {
  return c === 'USD' || c === 'EUR' ? c : 'CLP'
}

export function currencyDecimals(c: string | null | undefined): number {
  return normalizeCurrency(c) === 'CLP' ? 0 : 2
}

/** Redondea al peso (CLP) o al centavo (USD/EUR), como en un documento tributario. */
export function roundMoney(n: number, c: string | null | undefined): number {
  const f = 10 ** currencyDecimals(c)
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f
}

function format(n: number, c: string | null | undefined): string {
  const cur = normalizeCurrency(c)
  const d = currencyDecimals(cur)
  return n.toLocaleString('es-CL', {
    style: 'currency', currency: cur,
    // "$" para el peso, "US$" para el dólar (no se confunden), "€" para el euro.
    currencyDisplay: cur === 'USD' ? 'symbol' : 'narrowSymbol',
    minimumFractionDigits: d, maximumFractionDigits: d,
  })
}

/** Monto para mostrar; vacío o cero → "—" (campo sin dato). */
export function formatMoney(value: number | string | null | undefined, currency?: string | null): string {
  const n = Number(value)
  if (!value || isNaN(n)) return '—'
  return format(n, currency)
}

/** Como formatMoney, pero el cero se muestra "$0": en totales y saldos el cero es un dato. */
export function money(value: number | string | null | undefined, currency?: string | null): string {
  const n = Number(value)
  return format(Number.isFinite(n) ? n : 0, currency)
}

// ── Impuestos ─────────────────────────────────────────────────

export interface Tax { label: string; rate: number }

export const DEFAULT_TAXES: Tax[] = [{ label: 'IVA', rate: 19 }]
export const MAX_TAXES = 5

/** Lista de impuestos desde la base (jsonb) o desde una tasa única antigua. */
export function normalizeTaxes(raw: unknown, legacyRate?: number | null): Tax[] {
  if (Array.isArray(raw)) {
    return raw
      .map(t => ({ label: String((t as Tax)?.label ?? '').trim(), rate: Number((t as Tax)?.rate) }))
      .filter(t => t.label && Number.isFinite(t.rate))
  }
  const r = Number(legacyRate)
  return Number.isFinite(r) && r > 0 ? [{ label: 'IVA', rate: r }] : []
}

/** Texto corto: "IVA 19 % + Imp. adicional 10 %". */
export function taxesSummary(taxes: Tax[]): string {
  return taxes.length ? taxes.map(t => `${t.label} ${t.rate.toLocaleString('es-CL')} %`).join(' + ') : 'Sin impuestos'
}

// ── Campos de monto ───────────────────────────────────────────
// CLP: solo dígitos. USD/EUR: dígitos y una coma decimal (se acepta punto)
// con hasta 2 decimales. Los separadores de miles no se escriben.

/** Limpia lo que el usuario escribe en un campo de monto. */
export function sanitizeMoneyInput(raw: string, currency: string | null | undefined): string {
  if (!currencyDecimals(currency)) return raw.replace(/\D/g, '')
  const s = raw.replace(/\./g, ',').replace(/[^\d,]/g, '')
  const [int, ...rest] = s.split(',')
  return rest.length ? `${int},${rest.join('').slice(0, 2)}` : int
}

/** Valor numérico de un campo de monto (0 si está vacío). */
export function parseMoneyInput(raw: string, currency: string | null | undefined): number {
  const n = Number(sanitizeMoneyInput(raw, currency).replace(',', '.'))
  return Number.isFinite(n) ? roundMoney(n, currency) : 0
}

/** Número → texto para precargar un campo de monto. */
export function moneyInputValue(n: number | null | undefined, currency: string | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return ''
  return String(roundMoney(Number(n), currency)).replace('.', ',')
}
