// Cliente service_role (salta la RLS). Solo en el servidor y siempre
// después de verificar permisos con el cliente de sesión.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
