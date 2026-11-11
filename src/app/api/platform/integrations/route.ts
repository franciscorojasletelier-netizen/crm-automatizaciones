import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'
import crypto from 'crypto'
import { META_GRAPH_URL, metaAuthHeaders } from '@/lib/meta'

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
  const config = body.config ?? {}

  if (!organizationId || !provider) {
    return NextResponse.json({ error: 'organizationId y provider son requeridos' }, { status: 400 })
  }
  if (!['meta_leads', 'whatsapp', 'webhook_form', 'google_workspace', 'microsoft_365'].includes(provider)) {
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
  if (provider === 'google_workspace' && !config.pubsub_topic) {
    return NextResponse.json({ error: 'pubsub_topic es requerido para Google Workspace (proyecto de Pub/Sub del cliente)' }, { status: 400 })
  }

  // Meta Lead Ads: con el token (de usuario del sistema o de página) se
  // obtiene el token de la página y se suscribe la página a la app para el
  // campo leadgen — sin esto Meta nunca avisa los leads nuevos. Se guarda el
  // token de página (no vence si viene de un usuario del sistema).
  let warning: string | undefined
  if (provider === 'meta_leads' && accessToken) {
    const sub = await subscribePageToLeadgen(externalId, accessToken)
    if (sub.pageToken) accessToken = sub.pageToken
    warning = sub.warning
  }

  const { data, error } = await supabase.from('platform_integrations')
    .insert({ organization_id: organizationId, provider, external_id: externalId, access_token: accessToken || null, label: label || null, config })
    .select('id, organization_id, provider, external_id, access_token, label, is_active, config, created_at')
    .single()

  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true, integration: data, warning })
}

async function subscribePageToLeadgen(pageId: string, token: string): Promise<{ pageToken?: string; warning?: string }> {
  try {
    const pageRes = await fetch(`${META_GRAPH_URL}/${encodeURIComponent(pageId)}?fields=access_token`, { headers: metaAuthHeaders(token) })
    const page = await pageRes.json()
    const pageToken: string | undefined = page?.access_token
    if (!pageToken) {
      return { warning: `No se pudo obtener el token de la página: ${page?.error?.message ?? 'el token no tiene acceso a esa página'}` }
    }
    const subRes = await fetch(`${META_GRAPH_URL}/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=leadgen`, {
      method: 'POST', headers: metaAuthHeaders(pageToken),
    })
    const sub = await subRes.json()
    if (!sub?.success) {
      return { pageToken, warning: `La página no quedó suscrita a leadgen: ${sub?.error?.message ?? 'respuesta inesperada de Meta'}` }
    }
    return { pageToken }
  } catch {
    return { warning: 'No se pudo contactar a Meta para suscribir la página' }
  }
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
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await requirePlatformOwner()
  if (!supabase) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const { error } = await supabase.from('platform_integrations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
