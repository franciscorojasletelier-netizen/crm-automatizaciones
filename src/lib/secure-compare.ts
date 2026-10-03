import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'

/** Compara secretos en tiempo constante (no filtra cuántos caracteres coinciden). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

/** Cron autorizado: "Authorization: Bearer <CRON_SECRET>". Falla cerrado sin secreto. */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  return !!secret && safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)
}
