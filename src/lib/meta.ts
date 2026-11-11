// Versión única de la Graph API de Meta (WhatsApp Cloud API, Lead Ads y
// verificación de tokens). Meta retira cada versión ~2 años después de
// publicarla: v19.0/v20.0, que usaba el código, ya se retiraron (v20.0 el
// 24-09-2026) y las llamadas fallaban con error de versión.
// v25.0 vence el 29-07-2028. Se puede subir sin tocar código con la
// variable META_GRAPH_VERSION (p. ej. "v26.0").
export const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION?.trim() || 'v25.0')

export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/** Cabecera de autorización: el token no viaja en la URL (no queda en logs). */
export function metaAuthHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}
