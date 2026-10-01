export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { getCurrentProfile } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { runServiceChecks, type CheckStatus, type ServiceCheck } from '@/lib/service-checks'
import { CHILE_TZ } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader, Panel, Stat, StatStrip } from '@/components/ui/page'
import { AddReminderButton, ReminderActions, type Reminder } from '@/components/platform/service-reminders'

const STATUS_META: Record<CheckStatus, { label: string; chip: string; dot: string }> = {
  ok:          { label: 'Al día',      chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  aviso:       { label: 'Pronto',      chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',       dot: 'bg-amber-500' },
  urgente:     { label: 'Urgente',     chip: 'bg-red-50 text-red-700 ring-1 ring-red-200',             dot: 'bg-red-500' },
  vencido:     { label: 'Vencido',     chip: 'bg-red-600 text-white',                                  dot: 'bg-white' },
  desconocido: { label: 'Sin fecha',   chip: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',     dot: 'bg-slate-400' },
}

const GROUPS: ServiceCheck['group'][] = ['Recordatorios', 'Infraestructura', 'Módulos de clientes', 'Correo', 'Meta (WhatsApp / Leads)', 'Procesos automáticos']

/** Servicios revisados que no caducan: para no tener que volver a averiguarlo. */
const NO_EXPIRAN = [
  ['Vercel (hosting)', 'Plan Hobby: no se pausa por inactividad.'],
  ['GitHub (código)', 'El repositorio no vence.'],
  ['Resend (correo del sistema)', 'Las claves API no vencen; solo se revocan a mano.'],
  ['Variables de Vercel (CRON_SECRET, claves)', 'No vencen.'],
]

function DaysLeft({ c }: { c: ServiceCheck }) {
  if (c.daysLeft === null) return <span className="text-slate-400">—</span>
  if (c.daysLeft < 0) return <span className="font-semibold text-red-700 tabular-nums">Venció hace {-c.daysLeft} d</span>
  return (
    <span className={cn('font-semibold tabular-nums', c.status === 'urgente' ? 'text-red-700' : c.status === 'aviso' ? 'text-amber-700' : 'text-slate-900')}>
      {c.daysLeft === 0 ? 'Hoy' : `${c.daysLeft} ${c.daysLeft === 1 ? 'día' : 'días'}`}
    </span>
  )
}

export default async function ServiciosPage() {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase.from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) redirect('/dashboard')

  const [{ checks }, { data: reminderRows }] = await Promise.all([
    runServiceChecks(supabase, serviceClient()),
    supabase.from('service_reminders').select('id, name, category, expires_on, url, notes'),
  ])
  const reminders = new Map(((reminderRows ?? []) as Reminder[]).map(r => [`rem-${r.id}`, r]))

  const urgent = checks.filter(c => c.status === 'urgente' || c.status === 'vencido').length
  const soon = checks.filter(c => c.status === 'aviso').length
  const noDate = checks.filter(c => c.status === 'desconocido').length
  const next = checks.filter(c => c.daysLeft !== null && c.daysLeft >= 0).sort((a, b) => a.daysLeft! - b.daysLeft!)[0]
  const checkedAt = new Date().toLocaleString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Servicios y vencimientos"
        description={`Lo que puede caducar por tiempo o por falta de uso. Revisado el ${checkedAt}; recibes una notificación cuando algo queda a 7 días o menos.`}
      />

      <StatStrip>
        <Stat label="Requieren acción" value={urgent} tone={urgent ? 'danger' : 'success'} context={urgent ? 'Vencidos o a ≤ 7 días' : 'Nada urgente'} />
        <Stat label="Próximos 30 días" value={soon} tone={soon ? 'warning' : 'neutral'} />
        <Stat label="Próximo vencimiento" value={next ? (next.daysLeft === 0 ? 'Hoy' : `${next.daysLeft} d`) : '—'} context={next?.name ?? 'Sin fechas registradas'} />
        <Stat label="Sin fecha" value={noDate} tone={noDate ? 'warning' : 'neutral'} context={noDate ? 'Anota la fecha para recibir aviso' : 'Todo con fecha'} />
      </StatStrip>

      {GROUPS.map(group => {
        const items = checks.filter(c => c.group === group)
        if (items.length === 0 && group !== 'Recordatorios') return null
        return (
          <Panel key={group} title={group} padded={false}
            description={group === 'Recordatorios' ? 'Vencimientos que anotas tú: tokens, dominio, planes.' : undefined}
>
            <ul className="divide-y divide-slate-100">
              {items.map(c => {
                const meta = STATUS_META[c.status]
                const rem = reminders.get(c.id)
                return (
                  <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-64">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{c.name}</p>
                        <span className={cn('inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium', meta.chip)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} aria-hidden />{meta.label}
                        </span>
                      </div>
                      {c.detail && <p className="mt-0.5 text-[13px] text-slate-500">{c.detail}</p>}
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-accent-700 hover:underline">
                          Abrir <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-right text-[13px] w-28 shrink-0 pt-0.5">
                      <p className="text-xs text-slate-500">Quedan</p>
                      <DaysLeft c={c} />
                    </div>
                    {rem && <ReminderActions reminder={rem} />}
                  </li>
                )
              })}
            </ul>
            {group === 'Recordatorios' && (
              <div className={cn('px-4 py-3', items.length > 0 && 'border-t border-slate-100')}>
                <AddReminderButton />
              </div>
            )}
          </Panel>
        )
      })}

      <Panel title="Revisados: no vencen" padded={false}>
        <ul className="divide-y divide-slate-100">
          {NO_EXPIRAN.map(([name, why]) => (
            <li key={name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <span className="text-slate-900">{name}</span>
              <span className="text-slate-500 text-right">{why}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </PageContainer>
  )
}
