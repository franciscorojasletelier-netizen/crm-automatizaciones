// ============================================================
//  Vencimientos de servicios conectados al CRM.
//
//  Reúne lo que caduca por tiempo o por inactividad: pausa de Supabase
//  (plan Free), accesos OAuth de Gmail en modo Testing, tokens de Meta y
//  recordatorios manuales. Lo usan /plataforma/servicios y el cron diario.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

export type CheckStatus = 'ok' | 'aviso' | 'urgente' | 'vencido' | 'desconocido'

export interface ServiceCheck {
  id: string
  group: 'Infraestructura' | 'Procesos automáticos' | 'Correo' | 'Meta (WhatsApp / Leads)' | 'Módulos de clientes' | 'Recordatorios'
  name: string
  detail: string
  /** Días que faltan; null cuando no vence o no se sabe. */
  daysLeft: number | null
  status: CheckStatus
  url?: string
}

const DAY = 86_400_000

export function statusFor(daysLeft: number | null, warnAt = 30, urgentAt = 7): CheckStatus {
  if (daysLeft === null) return 'desconocido'
  if (daysLeft < 0) return 'vencido'
  if (daysLeft <= urgentAt) return 'urgente'
  if (daysLeft <= warnAt) return 'aviso'
  return 'ok'
}

const daysSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / DAY)
const daysUntil = (iso: string, now: number) => Math.floor((Date.parse(iso) - now) / DAY)

/** Intervalo esperado (min) a partir de la expresión cron, para detectar procesos detenidos. */
function expectedMinutes(schedule: string): number {
  const [min, hour] = schedule.split(/\s+/)
  if (/^\*\/(\d+)$/.test(min)) return Number(min.slice(2))
  if (/^\*\/(\d+)$/.test(hour ?? '')) return Number(hour.slice(2)) * 60
  return 24 * 60
}

const CRON_LABEL: Record<string, string> = {
  'cron-automations': 'Automatizaciones',
  'cron-sequences': 'Secuencias',
  'cron-collections': 'Avisos de cobranza',
  'cron-daily-tasks': 'Resumen diario de tareas',
  'cron-task-reminders': 'Recordatorios de tareas',
  'cron-email-renew': 'Renovación de correo conectado',
}

interface Health {
  now: string
  cron: { name: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null }[]
  http_24h: { ok: number; error: number; sin_respuesta: number; ultima_ok: string | null } | null
  last_user_activity: string | null
}

/** Token de Meta: el propio token consulta su vencimiento (debug_token). */
async function metaTokenExpiry(token: string): Promise<{ valid: boolean; expiresAt: number | null } | null> {
  try {
    const url = `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!res.ok) return null
    const d = (await res.json())?.data
    if (!d) return null
    const exp = Number(d.expires_at ?? 0)
    return { valid: !!d.is_valid, expiresAt: exp > 0 ? exp * 1000 : null }
  } catch { return null }
}

/**
 * @param userClient cliente con sesión del dueño (RPC de salud + recordatorios, pasan por RLS)
 * @param svc        service_role: cuentas e integraciones de todas las organizaciones
 */
export async function runServiceChecks(userClient: SupabaseClient, svc: SupabaseClient): Promise<{ checks: ServiceCheck[]; health: Health | null }> {
  const now = Date.now()
  const [healthRes, remindersRes, accountsRes, integrationsRes, modulesRes] = await Promise.all([
    userClient.rpc('platform_service_health'),
    userClient.from('service_reminders').select('id, name, category, expires_on, url, notes').order('expires_on', { ascending: true, nullsFirst: true }),
    svc.from('email_accounts').select('id, provider, email_address, is_active, connected_at, subscription_expires_at, organizations(name)').eq('is_active', true),
    svc.from('platform_integrations').select('id, provider, label, access_token, is_active, organizations(name)').in('provider', ['whatsapp', 'meta_leads']).eq('is_active', true),
    svc.from('organization_modules').select('id, module_key, expires_at, organizations(name)').eq('enabled', true).not('expires_at', 'is', null),
  ])
  const health = (healthRes.data ?? null) as Health | null
  return { checks: await buildChecks(now, health, remindersRes.data ?? [], accountsRes.data ?? [], integrationsRes.data ?? [], modulesRes.data ?? []), health }
}

async function buildChecks(now: number, health: Health | null, reminders: any[], accounts: any[], integrations: any[], modules: any[]): Promise<ServiceCheck[]> {
  const checks: ServiceCheck[] = []

  // ── Supabase: el plan Free pausa el proyecto tras 7 días sin actividad.
  const lastActivity = [health?.http_24h?.ultima_ok, health?.last_user_activity].filter(Boolean).sort().at(-1) as string | undefined
  const sbLeft = lastActivity ? 7 - daysSince(lastActivity, now) : null
  checks.push({
    id: 'supabase-pausa', group: 'Infraestructura', name: 'Base de datos (Supabase)',
    detail: lastActivity
      ? 'En plan Free se pausa tras 7 días sin actividad. Los procesos automáticos la usan cada 15 min, así que el contador se reinicia solo mientras funcionen.'
      : 'No se pudo leer la última actividad.',
    daysLeft: sbLeft, status: statusFor(sbLeft, 3, 2),
    url: 'https://supabase.com/dashboard/project/srjdkdazxhevpwjymskl',
  })

  // ── Procesos automáticos: detenidos si no corren en 2× su intervalo.
  for (const job of health?.cron ?? []) {
    const expected = expectedMinutes(job.schedule)
    const late = job.last_run ? (now - Date.parse(job.last_run)) / 60000 > expected * 2 + 5 : true
    const failed = job.last_status && job.last_status !== 'succeeded'
    checks.push({
      id: `cron-${job.name}`, group: 'Procesos automáticos', name: CRON_LABEL[job.name] ?? job.name,
      detail: !job.active ? 'Desactivado.'
        : failed ? `La última ejecución falló (${job.last_status}).`
        : late ? 'No ha corrido en el tiempo esperado.'
        : `Corre ${expected < 60 ? `cada ${expected} min` : expected < 1440 ? `cada ${expected / 60} h` : 'una vez al día'}. No vence.`,
      daysLeft: null,
      status: !job.active || failed || late ? 'urgente' : 'ok',
    })
  }
  if (health?.http_24h && (health.http_24h.error > 0)) {
    checks.push({
      id: 'cron-http', group: 'Procesos automáticos', name: 'Respuestas de la aplicación',
      detail: `${health.http_24h.error} llamadas recientes respondieron con error (${health.http_24h.ok} correctas).`,
      daysLeft: null, status: 'aviso',
    })
  }

  // ── Correo conectado.
  for (const a of accounts) {
    const org = a.organizations?.name ? ` · ${a.organizations.name}` : ''
    if (a.provider === 'google_workspace') {
      // App OAuth en modo "Testing": Google revoca el refresh token a los 7 días.
      const left = 7 - daysSince(a.connected_at, now)
      checks.push({
        id: `mail-${a.id}`, group: 'Correo', name: `Gmail ${a.email_address}${org}`,
        detail: 'Si la app de Google está en modo Testing, el acceso vence 7 días después de conectar. Al publicar la app (modo Production) deja de vencer. Para renovar: Configuración → reconectar.',
        daysLeft: left, status: statusFor(left, 3, 2),
        url: 'https://console.cloud.google.com/apis/credentials/consent',
      })
    } else {
      checks.push({
        id: `mail-${a.id}`, group: 'Correo', name: `Outlook ${a.email_address}${org}`,
        detail: 'El acceso se renueva solo cada 6 h; vence únicamente tras 90 días sin uso.',
        daysLeft: null, status: 'ok',
      })
    }
  }

  // ── Meta: token temporal (24 h), de 60 días o permanente (usuario del sistema).
  const metaResults = await Promise.all(integrations.map(async i => ({ i, r: i.access_token ? await metaTokenExpiry(i.access_token) : null })))
  for (const { i, r } of metaResults) {
    const label = `${i.provider === 'whatsapp' ? 'WhatsApp' : 'Meta Leads'}${i.label ? ` (${i.label})` : ''}${i.organizations?.name ? ` · ${i.organizations.name}` : ''}`
    const left = r?.expiresAt ? daysUntil(new Date(r.expiresAt).toISOString(), now) : null
    checks.push({
      id: `meta-${i.id}`, group: 'Meta (WhatsApp / Leads)', name: label,
      detail: !r ? 'No se pudo verificar el token con Meta.'
        : !r.valid ? 'El token ya no es válido: genera uno nuevo en Meta Business.'
        : r.expiresAt ? 'Token con vencimiento. Usa un token de "usuario del sistema" para que no expire.'
        : 'Token permanente (usuario del sistema). No vence.',
      daysLeft: left,
      status: !r ? 'desconocido' : !r.valid ? 'vencido' : r.expiresAt ? statusFor(left) : 'ok',
      url: 'https://business.facebook.com/settings/system-users',
    })
  }

  // ── Módulos contratados por plazo (se apagan solos al vencer).
  for (const m of modules) {
    const left = daysUntil(m.expires_at, now)
    checks.push({
      id: `mod-${m.id}`, group: 'Módulos de clientes',
      name: `${m.module_key.charAt(0).toUpperCase()}${m.module_key.slice(1)} · ${m.organizations?.name ?? 'Organización'}`,
      detail: left < 0 ? 'Vencido: el módulo ya no está disponible para el cliente.' : 'Se apaga solo al vencer. Renueva la fecha en la ficha de la organización.',
      daysLeft: left, status: statusFor(left),
    })
  }

  // ── Recordatorios manuales.
  for (const rem of reminders) {
    const left = rem.expires_on ? daysUntil(`${rem.expires_on}T23:59:59Z`, now) : null
    checks.push({
      id: `rem-${rem.id}`, group: 'Recordatorios', name: rem.name,
      detail: rem.notes ?? (rem.expires_on ? '' : 'Sin fecha: anótala para que el sistema te avise.'),
      daysLeft: left, status: statusFor(left), url: rem.url ?? undefined,
    })
  }

  return checks
}

/** Lo que merece aviso hoy (≤ 7 días, vencido o proceso detenido). */
export function needsAttention(c: ServiceCheck) {
  return c.status === 'urgente' || c.status === 'vencido'
}

/**
 * Aviso diario a los dueños de la plataforma (desde el cron). Sin sesión
 * de usuario no hay RPC de salud: revisa recordatorios, correo y Meta.
 * Un solo aviso por día con el resumen.
 */
export async function notifyServiceExpirations(svc: SupabaseClient): Promise<number> {
  const { checks } = await runServiceChecks(svc, svc)
  const pending = checks.filter(c => needsAttention(c) && c.group !== 'Infraestructura')
  if (pending.length === 0) return 0

  const { data: owners } = await svc.from('platform_owners').select('user_id')
  if (!owners?.length) return 0

  const title = pending.length === 1
    ? `⏳ Vence pronto: ${pending[0].name}`
    : `⏳ ${pending.length} servicios por vencer`
  const body = pending.slice(0, 4).map(c =>
    `${c.name}: ${c.daysLeft === null ? 'revisar' : c.daysLeft < 0 ? 'vencido' : c.daysLeft === 0 ? 'vence hoy' : `quedan ${c.daysLeft} d`}`,
  ).join(' · ') + '. Revisa Plataforma → Servicios.'

  const since = new Date(Date.now() - 20 * 3600_000).toISOString()
  let n = 0
  for (const { user_id } of owners) {
    const { count } = await svc.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user_id).eq('entity_type', 'service').gte('created_at', since)
    if (count) continue
    const { error } = await svc.from('notifications').insert({ user_id, type: 'automation', entity_type: 'service', title, body })
    if (!error) n++
  }
  return n
}
