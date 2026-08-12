import { NextRequest, NextResponse } from 'next/server'

const GRAPH = 'https://graph.facebook.com/v19.0'

// Endpoint TEMPORAL de configuración. Recibe un user access token (short-lived)
// del Graph API Explorer y deja todo listo:
//  1. Lo intercambia por un user token de larga duración (usando app secret)
//  2. Obtiene el Page Access Token (que NO expira al venir de un long-lived user token)
//  3. Suscribe la página al webhook con el campo leadgen
//  4. Devuelve el page token para guardarlo en Vercel
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const webhookToken = process.env.WEBHOOK_SECRET_TOKEN?.trim()
    if (!webhookToken || authHeader !== `Bearer ${webhookToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userToken } = await request.json()
    if (!userToken) {
      return NextResponse.json({ error: 'Falta userToken' }, { status: 400 })
    }

    const appId = process.env.META_APP_ID?.trim() || '4333932683544530'
    const appSecret = process.env.META_APP_SECRET?.trim()
    if (!appSecret) {
      return NextResponse.json({ error: 'META_APP_SECRET no configurado' }, { status: 500 })
    }

    const out: Record<string, unknown> = {}

    // 1. Intercambiar short-lived -> long-lived user token
    const llRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
    )
    const ll = await llRes.json()
    if (ll.error) {
      return NextResponse.json({ step: 'long_lived_exchange', error: ll.error }, { status: 400 })
    }
    const longUserToken = ll.access_token as string
    out.longLivedUserTokenObtained = !!longUserToken

    // 2. Obtener páginas + page tokens (derivados del long-lived user token => no expiran)
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,tasks&access_token=${longUserToken}`
    )
    const pages = await pagesRes.json()
    if (pages.error) {
      return NextResponse.json({ step: 'me_accounts', error: pages.error }, { status: 400 })
    }
    if (!pages.data || pages.data.length === 0) {
      return NextResponse.json({ step: 'me_accounts', error: 'No hay páginas asociadas a este usuario' }, { status: 400 })
    }

    // 3. Para cada página, suscribir la app al campo leadgen
    const results = []
    for (const page of pages.data) {
      const subRes = await fetch(
        `${GRAPH}/${page.id}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscribed_fields: 'leadgen',
            access_token: page.access_token,
          }),
        }
      )
      const sub = await subRes.json()
      results.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        subscribeResult: sub,
      })
    }

    out.pages = results
    return NextResponse.json(out)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
