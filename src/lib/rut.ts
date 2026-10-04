// RUT chileno: limpieza, dígito verificador y formato (12.345.678-5).

export function cleanRut(raw: string): string {
  return raw.replace(/[^0-9kK]/g, '').toUpperCase()
}

function verifier(body: string): string {
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

export function isValidRut(raw: string): boolean {
  const c = cleanRut(raw)
  if (c.length < 2) return false
  const body = c.slice(0, -1), dv = c.slice(-1)
  if (!/^\d{6,9}$/.test(body)) return false
  return verifier(body) === dv
}

export function formatRut(raw: string): string {
  const c = cleanRut(raw)
  if (c.length < 2) return c
  const body = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${c.slice(-1)}`
}
