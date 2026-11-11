import { serviceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

// Requiere un cliente service_role — rate_limit_hits no tiene GRANT
// para authenticated/anon a propósito (ver migración 021).
export async function checkRateLimit(
  admin: SupabaseClient,
  bucket: string,
  key: string,
  { maxHits, windowMinutes }: { maxHits: number; windowMinutes: number }
): Promise<{ allowed: boolean }> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { count } = await admin
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket).eq('rl_key', key).gte('created_at', since)

  if ((count ?? 0) >= maxHits) return { allowed: false }

  await admin.from('rate_limit_hits').insert({ bucket, rl_key: key })
  return { allowed: true }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Tope por usuario para acciones que salen del CRM (correos, WhatsApp, IA):
// una sesión robada o un script no pueden usar la cuenta para envíos
// masivos ni para gastar la cuota de IA. Devuelve la respuesta 429 lista,
// o null si puede seguir.
export async function userRateLimit(
  bucket: string, userId: string, maxHits: number, windowMinutes: number
): Promise<Response | null> {
  const { allowed } = await checkRateLimit(serviceClient(), bucket, userId, { maxHits, windowMinutes })
  if (allowed) return null
  return Response.json(
    { error: 'Demasiados envíos seguidos. Espera unos minutos y vuelve a intentar.' },
    { status: 429, headers: { 'Retry-After': String(windowMinutes * 60) } }
  )
}
