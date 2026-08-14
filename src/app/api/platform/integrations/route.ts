import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import crypto from 'crypto'

async function requirePlatformOwner() {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return null
  return supabase
}

export async function POST(request: NextRequest) {
  const supabase = await requirePlatformOwner()
  if (!supabase) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json()
  const { organizationId, provider, label } = body
  let { externalId, accessToken } = body

  if (!organizationId || !provider) {
    return NextResponse.json({ error: 'organizationId y provider son requeridos' }, { status: 400 })
  }
  if (!['meta_leads', 'whatsapp', 'webhook_form'].includes(provider)) {
    return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
  }

  // webhook_form no tiene un identificador de terceros — se generan acá:
  // el "external_id" es solo una clave interna única, y el token real es
  // el secreto que el cliente configura como Bearer en su formulario.
  if (provider === 'webhook_form') {
    externalId = externalId || `wf_${crypto.randomBytes(8).toString('hex')}`
    accessToken = accessToken || crypto.randomBytes(24).toString('base64url')
  }
  if (!externalId) {
    return NextResponse.json({ error: 'externalId es requerido para este proveedor' }, { status: 400 })
  }

  const { data, error } = await supabase.from('platform_integrations')
    .insert({ organization_id: organizationId, provider, external_id: externalId, access_token: accessToken || null, label: label || null })
    .select('id, organization_id, provider, external_id, access_token, label, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, integration: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await requirePlatformOwner()
  if (!supabase) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json()
  const { id, isActive } = body
  if (!id || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'id e isActive son requeridos' }, { status: 400 })
  }

  const { error } = await supabase.from('platform_integrations').update({ is_active: isActive }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await requirePlatformOwner()
  if (!supabase) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const { error } = await supabase.from('platform_integrations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
