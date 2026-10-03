export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle, Clock, Wallet, ArrowRight, TrendingUp } from 'lucide-react'
import { getCurrentProfile } from '@/lib/supabase/server'
import DashboardDonut from '@/components/dashboard/donut-chart'
import { money, timeAgo } from '@/lib/format'
import { getStages, defaultStage, stageByKey, colorOf, funnelStages as funnelOf, probabilityForStage } from '@/lib/stages'
import { CHILE_TZ, chileDateString, chileMonthStart } from '@/lib/dates'
import { canAccessSection } from '@/lib/roles'
import { getDisabledModules } from '@/lib/modules'
import { balanceOf, daysOverdue, invoiceCode, type Invoice } from '@/lib/cobranza'
import { PageContainer, PageHeader, Panel, Stat, StatStrip, EmptyState, Delta } from '@/components/ui/page'
import { cn } from '@/lib/utils'

const STALLED_DAYS = 7
const DAY_MS = 86_400_000

type OpenDeal = {
  id: string; stage: string; estimated_value: number | null; probability: number | null
  next_action: string | null; updated_at: string; last_contacted_at: string | null; created_at: string
  companies: { name: string } | null; profiles: { full_name: string | null } | null
}

export default async function DashboardPage() {
  const { supabase, organizationId, role, sectionAccess, profile, currency } = await getCurrentProfile()
  const now = new Date()
  const today = chileDateString(now)
  const monthStart = chileMonthStart(0, now).toISOString()
  const prevMonthStart = chileMonthStart(-1, now).toISOString()

  const [stages, disabledModules] = await Promise.all([
    getStages(supabase, organizationId ?? undefined),
    getDisabledModules(supabase, organizationId ?? undefined),
  ])
  const sees = (key: string) => canAccessSection(role, sectionAccess, key, disabledModules)
  const seesPipeline = sees('pipeline')
  const seesCobranza = sees('cobranza')
  const entryStageKey = defaultStage(stages)?.key ?? '__sin_etapa__'

  const [openRes, wonMonthRes, wonPrevRes, tasksOverdueRes, overdueTasksRes, chartRes, newLeadsRes, invoicesRes] = await Promise.all([
    supabase.from('deals')
      .select('id, stage, estimated_value, probability, next_action, updated_at, last_contacted_at, created_at, companies(name), profiles:owner_id(full_name)')
      .eq('status', 'open').order('updated_at', { ascending: false }).limit(2000),
    // Por fecha real de cierre (041), no por la última edición.
    supabase.from('deals').select('estimated_value').eq('status', 'won').gte('closed_at', monthStart),
    supabase.from('deals').select('estimated_value').eq('status', 'won').gte('closed_at', prevMonthStart).lt('closed_at', monthStart),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false).lt('due_date', now.toISOString()),
    supabase.from('tasks').select('id, title, due_date, deals(companies(name))')
      .eq('is_completed', false).lt('due_date', now.toISOString()).order('due_date', { ascending: true }).limit(5),
    supabase.from('deals').select('stage, source, estimated_value, profiles:owner_id(full_name), companies(industry)').limit(5000),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('stage', entryStageKey).eq('status', 'open'),
    seesCobranza
      ? supabase.from('invoices').select('id, invoice_number, amount, paid_amount, status, due_date, companies(name)').in('status', ['pendiente', 'parcial']).limit(2000)
      : Promise.resolve({ data: [] }),
  ])

  const open = (openRes.data ?? []) as unknown as OpenDeal[]
  const value = (v: number | null) => Number(v) || 0
  const pipelineValue = open.reduce((s, d) => s + value(d.estimated_value), 0)
  const forecast = Math.round(open.reduce((s, d) => s + value(d.estimated_value) * probabilityForStage(stages, d.stage, d.probability) / 100, 0))
  const wonMonth = (wonMonthRes.data ?? []).reduce((s, d) => s + value(d.estimated_value), 0)
  const wonMonthCount = wonMonthRes.data?.length ?? 0
  const wonPrev = (wonPrevRes.data ?? []).reduce((s, d) => s + value(d.estimated_value), 0)
  const wonDelta = wonPrev > 0 ? Math.round(((wonMonth - wonPrev) / wonPrev) * 100) : null

  const staleDays = (d: OpenDeal) => Math.floor((now.getTime() - Date.parse(d.last_contacted_at ?? d.created_at)) / DAY_MS)
  const stalled = open.filter(d => staleDays(d) >= STALLED_DAYS).sort((a, b) => staleDays(b) - staleDays(a))

  const invoices = (invoicesRes.data ?? []) as unknown as Invoice[]
  const overdueInvoices = invoices.filter(i => daysOverdue(i, today) > 0).sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today))
  const overdueAmount = overdueInvoices.reduce((s, i) => s + balanceOf(i), 0)
  const receivable = invoices.reduce((s, i) => s + balanceOf(i), 0)

  const tasksOverdue = tasksOverdueRes.count ?? 0
  const overdueTasks = (overdueTasksRes.data ?? []) as unknown as { id: string; title: string; due_date: string; deals: { companies: { name: string } | null } | null }[]

  // Embudo: conteo y valor por etapa (solo deals abiertos).
  const byStage: Record<string, { count: number; amount: number }> = {}
  for (const d of open) {
    byStage[d.stage] ??= { count: 0, amount: 0 }
    byStage[d.stage].count++
    byStage[d.stage].amount += value(d.estimated_value)
  }
  const funnel = funnelOf(stages)
  const maxFunnel = Math.max(...funnel.map(s => byStage[s.key]?.amount || byStage[s.key]?.count || 0), 1)

  // Distribución (donut)
  const chartDeals = (chartRes.data ?? []) as unknown as { stage: string; source: string | null; estimated_value: number | null; profiles: { full_name: string | null } | null; companies: { industry: string | null } | null }[]
  const PALETTE = ['#3b63d9', '#0f9f8f', '#d9922b', '#c2415c', '#7a5cc9', '#4b8fd6', '#8a9a3a', '#94a3b8']
  function groupBy(key: (d: (typeof chartDeals)[number]) => string | null | undefined) {
    const map: Record<string, { count: number; amount: number }> = {}
    for (const d of chartDeals) {
      const k = key(d) || 'Sin datos'
      map[k] ??= { count: 0, amount: 0 }
      map[k].count++
      map[k].amount += value(d.estimated_value)
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count)
      .map(([label, v], i) => ({ label, value: v.count, amount: v.amount, color: PALETTE[i % PALETTE.length] }))
  }
  const byEtapa = groupBy(d => d.stage).map(s => {
    const st = stageByKey(stages, s.label)
    return { ...s, label: st?.label ?? s.label, color: colorOf(st).hex }
  })

  const firstName = profile?.full_name?.split(' ')[0]
  const attentionCount = stalled.length + tasksOverdue + overdueInvoices.length

  return (
    <PageContainer>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : 'Dashboard'}
        description={now.toLocaleDateString('es-CL', { timeZone: CHILE_TZ, weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <StatStrip>
        {seesPipeline ? (
          <Stat label="Pipeline abierto" value={money(pipelineValue, currency)} href="/pipeline"
            context={`${open.length} ${open.length === 1 ? 'deal' : 'deals'} · ${newLeadsRes.count ?? 0} nuevos`} />
        ) : (
          <Stat label="Tareas vencidas" value={tasksOverdue} tone={tasksOverdue > 0 ? 'danger' : 'neutral'} href="/tareas" context="Asignadas a ti" />
        )}
        <Stat label="Ganado este mes" value={money(wonMonth, currency)} tone={wonMonth > 0 ? 'success' : 'neutral'} href={seesPipeline ? '/reportes' : undefined}
          context={<span>{wonMonthCount} {wonMonthCount === 1 ? 'cierre' : 'cierres'} · <Delta value={wonDelta} suffix="%" /> vs. mes anterior</span>} />
        <Stat label="Forecast ponderado" value={money(forecast, currency)} href={seesPipeline ? '/reportes' : undefined}
          context="Valor × probabilidad de cada etapa" />
        {seesCobranza ? (
          <Stat label="Cobranza vencida" value={money(overdueAmount, currency)} tone={overdueAmount > 0 ? 'danger' : 'neutral'} href="/cobranza?filtro=vencidos"
            context={`De ${money(receivable, currency)} por cobrar`} />
        ) : (
          <Stat label="Tareas vencidas" value={tasksOverdue} tone={tasksOverdue > 0 ? 'danger' : 'neutral'} href="/tareas"
            context={tasksOverdue > 0 ? 'Requieren acción' : 'Al día'} />
        )}
      </StatStrip>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Requiere atención" padded={false}
          description={attentionCount > 0 ? 'Lo que conviene resolver hoy' : undefined}>
          {attentionCount === 0 ? (
            <EmptyState title="Todo al día" description="No hay deals estancados, tareas vencidas ni cobros vencidos." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdueInvoices.slice(0, 4).map(inv => (
                <li key={inv.id}>
                  <Link href={`/cobranza/${inv.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <Wallet className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="min-w-0 flex-1 text-[13px] text-slate-800 truncate">
                      Cobro vencido · <span className="font-medium">{inv.companies?.name}</span> <span className="text-slate-500">{invoiceCode(inv)}</span>
                    </span>
                    <span className="text-xs font-medium text-red-700 tabular-nums whitespace-nowrap">{daysOverdue(inv, today)} días · {money(balanceOf(inv), currency)}</span>
                  </Link>
                </li>
              ))}
              {overdueTasks.map(t => (
                <li key={t.id}>
                  <Link href={`/tareas?tarea=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="min-w-0 flex-1 text-[13px] text-slate-800 truncate">
                      Tarea vencida · <span className="font-medium">{t.title}</span>
                      {t.deals?.companies?.name && <span className="text-slate-500"> · {t.deals.companies.name}</span>}
                    </span>
                    <span className="text-xs text-amber-700 tabular-nums whitespace-nowrap">
                      {new Date(t.due_date).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
              {seesPipeline && stalled.slice(0, 5).map(d => (
                <li key={d.id}>
                  <Link href={`/leads/${d.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="min-w-0 flex-1 text-[13px] text-slate-800 truncate">
                      Deal sin contacto · <span className="font-medium">{d.companies?.name ?? 'Sin empresa'}</span>
                      {d.profiles?.full_name && <span className="text-slate-500"> · {d.profiles.full_name}</span>}
                    </span>
                    <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">{staleDays(d)} días</span>
                  </Link>
                </li>
              ))}
              {(tasksOverdue > overdueTasks.length || stalled.length > 5) && (
                <li className="px-4 py-2 text-xs text-slate-500">
                  {tasksOverdue > overdueTasks.length && <Link href="/tareas" className="hover:underline mr-3">+{tasksOverdue - overdueTasks.length} tareas vencidas</Link>}
                  {seesPipeline && stalled.length > 5 && <Link href="/pipeline" className="hover:underline">+{stalled.length - 5} deals estancados</Link>}
                </li>
              )}
            </ul>
          )}
        </Panel>

        {seesPipeline && (
          <Panel title="Embudo" description="Deals abiertos por etapa"
            actions={<Link href="/pipeline" className="text-[13px] text-accent-700 hover:underline inline-flex items-center gap-1">Pipeline <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {funnel.every(s => !byStage[s.key]) ? (
              <EmptyState icon={TrendingUp} title="Sin deals abiertos" />
            ) : (
              <ul className="space-y-3">
                {funnel.map(stage => {
                  const row = byStage[stage.key] ?? { count: 0, amount: 0 }
                  const pct = Math.max(row.amount || row.count ? 2 : 0, Math.round(((row.amount || row.count) / maxFunnel) * 100))
                  return (
                    <li key={stage.key}>
                      <div className="flex items-baseline justify-between gap-2 text-[13px] mb-1">
                        <span className="text-slate-700 truncate">{stage.label}</span>
                        <span className="tabular-nums text-slate-500 whitespace-nowrap">
                          <span className="text-slate-900 font-medium">{row.count}</span>{row.amount > 0 && ` · ${money(row.amount, currency)}`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', colorOf(stage).dot)} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {seesPipeline && (
        <>
          <div className="mt-4">
            <DashboardDonut
              byEtapa={byEtapa}
              byFuente={groupBy(d => d.source)}
              byIndustria={groupBy(d => d.companies?.industry)}
              byResponsable={groupBy(d => d.profiles?.full_name)}
            />
          </div>

          <Panel className="mt-4" title="Deals con movimiento reciente" padded={false}
            actions={<Link href="/leads" className="text-[13px] text-accent-700 hover:underline inline-flex items-center gap-1">Todos los leads <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {open.length === 0 ? (
              <EmptyState title="No hay deals abiertos" description="Los leads del formulario web, Meta y WhatsApp aparecerán aquí." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th scope="col" className="font-medium px-4 py-2">Empresa</th>
                      <th scope="col" className="font-medium px-3 py-2 hidden sm:table-cell">Etapa</th>
                      <th scope="col" className="font-medium px-3 py-2 hidden lg:table-cell">Próxima acción</th>
                      <th scope="col" className="font-medium px-3 py-2 text-right">Valor</th>
                      <th scope="col" className="font-medium px-4 py-2 text-right hidden sm:table-cell">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {open.slice(0, 8).map(d => {
                      const st = stageByKey(stages, d.stage)
                      return (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <Link href={`/leads/${d.id}`} className="font-medium text-slate-900 hover:text-accent-700">{d.companies?.name ?? 'Sin empresa'}</Link>
                            {d.profiles?.full_name && <span className="block text-xs text-slate-500">{d.profiles.full_name}</span>}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-slate-700">
                              <span className={cn('w-1.5 h-1.5 rounded-full', colorOf(st).dot)} aria-hidden />{st?.label ?? d.stage}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate hidden lg:table-cell">{d.next_action ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{d.estimated_value ? money(d.estimated_value, currency) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500 whitespace-nowrap hidden sm:table-cell">{timeAgo(d.updated_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </PageContainer>
  )
}
