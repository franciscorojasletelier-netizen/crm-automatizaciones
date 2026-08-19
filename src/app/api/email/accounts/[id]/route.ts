import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

// Con el cliente de sesión (no service_role): la policy
// "email_accounts_delete" ya limita el borrado a `user_id = auth.uid()`
// (o platform_owner), así que no hace falta re-verificar acá.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await getCurrentProfile()

  const { error } = await supabase.from('email_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
