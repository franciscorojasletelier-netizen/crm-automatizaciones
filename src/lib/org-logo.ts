// Subida del logo de una organización al bucket público "logos".
// Lo usan Configuración (cada empresa) y Plataforma (dueño, al crear o
// editar cualquier organización). La RLS de storage decide quién puede.
import type { SupabaseClient } from '@supabase/supabase-js'

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_BYTES = 512 * 1024

/** Mensaje de error si el archivo no sirve; null si está bien. */
export function validateLogo(file: File): string | null {
  if (!LOGO_TYPES.includes(file.type)) return 'El logo debe ser PNG, JPG o WebP.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo no puede pesar más de 512 KB.'
  return null
}

/** Sube el logo y lo deja como logo_url de la organización. Devuelve la URL o un error. */
export async function uploadOrgLogo(sb: SupabaseClient, organizationId: string, file: File): Promise<{ url: string } | { error: string }> {
  const invalid = validateLogo(file)
  if (invalid) return { error: invalid }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  // Nombre nuevo en cada subida: los clientes de correo cachean la URL.
  const path = `${organizationId}/logo-${Date.now()}.${ext}`
  const { error: upErr } = await sb.storage.from('logos').upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) return { error: upErr.message }
  const url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl
  const { error } = await sb.from('organizations').update({ logo_url: url }).eq('id', organizationId)
  if (error) return { error: error.message }
  return { url }
}
