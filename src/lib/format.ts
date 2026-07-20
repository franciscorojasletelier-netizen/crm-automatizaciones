// Formato de moneda del CRM: pesos chilenos (CLP)
// CLP no usa decimales; separador de miles con puntos. Ej: $5.000.000
export function formatCLP(value: number | string | null | undefined): string {
  const n = Number(value)
  if (!value || isNaN(n)) return '—'
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}
