import { NextResponse } from 'next/server'

export async function GET() {
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN?.trim()
  if (!pageToken) {
    return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN no configurado' })
  }

  const out: Record<string, unknown> = {}

  // 1. Validar el token y obtener la página
  const meRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${pageToken}`
  )
  const me = await meRes.json()
  out.tokenValid = !me.error
  out.page = me.error ? me.error : me

  // 2. Si tenemos page id, ver apps suscritas (qué campos)
  if (me.id) {
    const subRes = await fetch(
      `https://graph.facebook.com/v19.0/${me.id}/subscribed_apps?access_token=${pageToken}`
    )
    const sub = await subRes.json()
    out.subscribedApps = sub
  }

  return NextResponse.json(out)
}
