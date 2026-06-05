'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, Trash2, ToggleLeft, ToggleRight, Clock, CheckCircle2, XCircle, SkipForward, Activity } from 'lucide-react'

interface Rule {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, any>
  action_type: string
  action_config: Record<string, any>
  is_active: boolean
  run_count: number
  last_run_at: string | null
  created_at: string
  profiles?: { full_name: string | null } | null
}

interface Log {
  id: string
  rule_id: string | null
  rule_name: string | null
  entity_type: string | null
  status: string
  details: Record<string, any> | null
  executed_at: string
  automation_rules?: { name: string } | null
}

interface Props {
  rules: Rule[]
  logs: Log[]
}

const triggerLabels: Record<string, string> = {
  stage_change:  'Cambio de etapa',
  days_inactive: 'Días sin actividad',
  deal_won:      'Deal ganado',
  deal_lost:     'Deal perdido',
  task_overdue:  'Tarea vencida',
}

const actionLabels: Record<string, string> = {
  create_task:  'Crear tarea',
  notify_owner: 'Notificar ejecutivo',
  notify_team:  'Notificar equipo',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function triggerSummary(rule: Rule): string {
  const cfg = rule.trigger_config
  if (rule.trigger_type === 'stage_change') {
    return `→ ${cfg.to_stage === 'any' ? 'cualquier etapa' : cfg.to_stage?.replace(/_/g, ' ')}`
  }
  if (rule.trigger_type === 'days_inactive') return `${cfg.days ?? 7} días inactivo`
  return ''
}

function actionSummary(rule: Rule): string {
  const cfg = rule.action_config
  if (rule.action_type === 'create_task') return `"${cfg.title ?? 'Tarea'}" en ${cfg.days_after ?? 1}d`
  if (rule.action_type === 'notify_owner' || rule.action_type === 'notify_team') {
    return cfg.message ? cfg.message.slice(0, 40) + (cfg.message.length > 40 ? '…' : '') : 'Sin mensaje'
  }
  return ''
}

export default function AutomationRulesList({ rules: initialRules, logs }: Props) {
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [tab, setTab] = useState<'rules' | 'logs'>('rules')
  const supabase = createClient()
  const router = useRouter()

  async function toggleActive(rule: Rule) {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    router.refresh()
  }

  async function deleteRule(id: string) {
    if (!confirm('¿Eliminar esta regla? Esta acción no se puede deshacer.')) return
    setRules(prev => prev.filter(r => r.id !== id))
    await supabase.from('automation_rules').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit">
        {([['rules', 'Reglas'], ['logs', 'Historial']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}>
            {l} {t === 'rules' ? `(${rules.length})` : `(${logs.length})`}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-400">Sin reglas configuradas</p>
              <p className="text-xs text-slate-300 text-center">Crea tu primera regla usando el formulario</p>
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
              rule.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    rule.is_active ? 'bg-indigo-100' : 'bg-slate-100'
                  }`}>
                    <Zap className={`w-3.5 h-3.5 ${rule.is_active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rule.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {rule.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Si:</span>
                        <span className="text-xs font-medium text-slate-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                          {triggerLabels[rule.trigger_type]} {triggerSummary(rule)}
                        </span>
                      </div>
                      <span className="text-slate-200">→</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Entonces:</span>
                        <span className="text-xs font-medium text-slate-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {actionLabels[rule.action_type]}: {actionSummary(rule)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {rule.run_count} ejecuciones
                      </span>
                      {rule.last_run_at && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Última: {timeAgo(rule.last_run_at)}
                        </span>
                      )}
                      {rule.profiles?.full_name && (
                        <span className="text-[10px] text-slate-400">Por: {rule.profiles.full_name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(rule)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                    title={rule.is_active ? 'Desactivar' : 'Activar'}>
                    {rule.is_active
                      ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>
                  <button onClick={() => deleteRule(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-slate-300 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-3">
              <Clock className="w-8 h-8 text-slate-200" />
              <p className="text-sm text-slate-400 font-medium">Sin historial de ejecuciones</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map((log) => {
                const StatusIcon = log.status === 'success' ? CheckCircle2 : log.status === 'failed' ? XCircle : SkipForward
                const statusColor = log.status === 'success' ? 'text-emerald-500' : log.status === 'failed' ? 'text-red-500' : 'text-slate-400'
                return (
                  <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                    <StatusIcon className={`w-4 h-4 shrink-0 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {log.automation_rules?.name ?? log.rule_name ?? 'Regla eliminada'}
                      </p>
                      {log.details && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {typeof log.details === 'object' ? JSON.stringify(log.details).slice(0, 60) : String(log.details)}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      log.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      log.status === 'failed'  ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>{log.status}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(log.executed_at)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
