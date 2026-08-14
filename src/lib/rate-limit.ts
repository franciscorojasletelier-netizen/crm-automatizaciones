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
