import type { SupabaseClient } from '@supabase/supabase-js'

const WA_API_URL = 'https://graph.facebook.com/v20.0'

export interface SendWhatsAppResult {
  ok: boolean
  error?: string
  outsideWindow?: boolean
  messageId?: string | null
  message?: any
}

// Extraído de /api/whatsapp/send para reutilizarlo desde el cron de
// secuencias de follow-up — mismo camino de credenciales por organización
// (con fallback a las env vars globales) y mismo registro en whatsapp_messages.
export async function sendWhatsAppText(
  supabase: SupabaseClient,
  { organizationId, dealId, phone, body, sentBy }: {
    organizationId: string; dealId: string; phone: string; body: string; sentBy: string | null
  }
): Promise<SendWhatsAppResult> {
  const normalized = phone.replace(/\D/g, '')
  const intlPhone = normalized.startsWith('56') ? normalized : `56${normalized}`

  const { data: integration } = await supabase
    .from('platform_integrations')
    .select('external_id, access_token')
    .eq('provider', 'whatsapp').eq('organization_id', organizationId).eq('is_active', true)
    .maybeSingle()

  const waToken   = integration?.access_token || process.env.WHATSAPP_ACCESS_TOKEN
  const waPhoneId = integration?.external_id  || process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!waToken || !waPhoneId) {
    return { ok: false, error: 'WhatsApp API no configurada para esta organización.' }
  }

  const waRes = await fetch(`${WA_API_URL}/${waPhoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: intlPhone, type: 'text', text: { body },
    }),
  })
  const waData = await waRes.json()

  if (!waRes.ok) {
    const isOutsideWindow = waData?.error?.code === 131047
      || /24.?hour|re-?engagement/i.test(waData?.error?.message ?? '')
    return {
      ok: false, outsideWindow: isOutsideWindow,
      error: isOutsideWindow
        ? 'Pasaron más de 24h desde el último mensaje del cliente. Hace falta una plantilla aprobada.'
        : (waData?.error?.message ?? 'Error al enviar por WhatsApp'),
    }
  }

  const waMessageId = waData?.messages?.[0]?.id ?? null
  const { data: saved } = await supabase.from('whatsapp_messages').insert({
    deal_id: dealId, direction: 'outbound', body, wa_message_id: waMessageId,
    status: 'sent', sent_by: sentBy,
  }).select().single()

  return { ok: true, messageId: waMessageId, message: saved }
}
