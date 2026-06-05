export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import { GitBranch, Zap } from 'lucide-react'
import AutomationRulesList from '@/components/automations/automation-rules-list'
import AutomationRuleForm from '@/components/automations/automation-rule-form'

export default async function AutomatizacionesPage() {
  const { supabase, profile } = await requirePermission('automatizaciones')

  const [{ data: rules }, { data: logs }] = await Promise.all([
    supabase
      .from('automation_rules')
      .select('*, profiles:created_by(full_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('automation_logs')
      .select('*, automation_rules(name)')
      .order('executed_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automatizaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Reglas automáticas para el equipo comercial</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-xl font-semibold shadow-sm">
          <Zap className="w-3.5 h-3.5" />
          {(rules ?? []).filter((r: any) => r.is_active).length} activas
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/30 flex items-center justify-center">
              <GitBranch className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <p className="text-sm font-bold">¿Cómo funcionan las automatizaciones?</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { step: '1', label: 'Disparador', desc: 'Define qué evento activa la regla (ej: cambio de etapa, días inactivo)' },
              { step: '2', label: 'Condición', desc: 'Configura en qué etapa o cuántos días deben cumplirse' },
              { step: '3', label: 'Acción', desc: 'Qué hace el sistema: crear tarea, notificar, etc.' },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-white text-xs">{label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Formulario crear regla */}
        <div className="lg:col-span-1">
          <AutomationRuleForm createdBy={profile?.id ?? ''} />
        </div>

        {/* Lista de reglas */}
        <div className="lg:col-span-2 space-y-4">
          <AutomationRulesList rules={(rules ?? []) as any} logs={(logs ?? []) as any} />
        </div>
      </div>
    </div>
  )
}
