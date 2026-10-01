export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/supabase/server'
import { CHILE_TZ } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader, Panel, EmptyState } from '@/components/ui/page'
import ReminderSettingsForm from '@/components/cobranza/reminder-settings-form'
import { DEFAULT_SETTINGS, MILESTONE_LABEL, planReminders, type ReminderSettings } from '@/lib/cobranza-recordatorios'
import { TONE_META } from '@/lib/cobranza-mensajes'
import { systemMailAddress, systemMailConfigured } from '@/lib/email/system-mail'
import { BellRing } from 'lucide-react'

const COLLECTION_MANAGERS = ['super_admin', 'gerente', 'finanzas']
const fmtStamp = (d: string) =>
  new Date(d).toLocaleString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function RecordatoriosPage() {
  const { role, canEdit, supabase, organizationId } = await requirePermission('cobranza')
  if (!canEdit || !COLLECTION_MANAGERS.includes(role) || !organizationId) redirect('/cobranza')

  const [{ data: row }, { data: history }] = await Promise.all([
    supabase.from('collection_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('invoice_reminders').select('id, milestone, sent_to, sent_at, invoices(invoice_number, document_folio, companies(name))')
      .order('sent_at', { ascending: false }).limit(30),
  ])
  const settings = { ...DEFAULT_SETTINGS, ...(row as Partial<ReminderSettings> | null ?? {}) }
  // Vista previa con la configuración guardada aunque esté apagada.
  const { plan } = await planReminders(supabase, organizationId, settings)
  const mailOk = systemMailConfigured()
  const from = systemMailAddress()

  return (
    <PageContainer className="space-y-4 max-w-[960px]">
      <PageHeader
        back={{ href: '/cobranza', label: 'Cobranza' }}
        title="Recordatorios automáticos"
        description="Correos de cobro que el CRM envía solo a cada cliente, con su estado de cuenta."
      />

      <Panel title="Configuración"
        description={mailOk ? `Salen desde ${from}; las respuestas llegan al responsable del documento.` : 'El correo del sistema aún no está activado.'}>
        <ReminderSettingsForm organizationId={organizationId}
          initial={{ auto_reminders: settings.auto_reminders, days_before: settings.days_before, on_due_date: settings.on_due_date, days_after: settings.days_after }}
          canSend={mailOk} />
      </Panel>

      <Panel padded={false} title="Saldría hoy"
        description={settings.auto_reminders ? 'Lo que el envío de mañana considera según los hitos.' : 'Vista previa: así quedaría hoy si estuvieran activados.'}>
        {plan.length === 0 ? (
          <EmptyState icon={BellRing} title="Nada que recordar hoy" description="Ningún documento está en un hito de aviso." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {plan.map(p => (
              <li key={p.companyId} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{p.companyName}</p>
                  <p className="text-xs text-slate-500">
                    {p.invoices.length} {p.invoices.length === 1 ? 'documento' : 'documentos'} · {[...new Set(p.invoices.map(i => MILESTONE_LABEL(i.milestone)))].join(', ')} · tono {TONE_META[p.tone].label.toLowerCase()}
                  </p>
                </div>
                <span className={cn('text-xs', p.skipped ? 'text-amber-700' : 'text-slate-600')}>
                  {p.skipped === 'sin_correo' ? 'Sin correo de contacto: no se enviará'
                    : p.skipped === 'correo_no_entregable' ? `${p.to}: dirección de prueba, se omite`
                    : `Para ${p.to}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel padded={false} title="Enviados" description="Últimos 30 recordatorios automáticos.">
        {(history ?? []).length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">Todavía no se ha enviado ninguno.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(history ?? []).map((h: any) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span className="text-slate-900">
                  {h.invoices?.companies?.name ?? 'Cliente'} · <span className="text-slate-500">{MILESTONE_LABEL(h.milestone)}</span>
                </span>
                <span className="text-slate-500">{h.sent_to} · {fmtStamp(h.sent_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContainer>
  )
}
