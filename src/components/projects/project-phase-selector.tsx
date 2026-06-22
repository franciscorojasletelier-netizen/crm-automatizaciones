'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertTriangle, Lock } from 'lucide-react'

const phases = [
  { key: 'discovery',  label: 'Discovery',        active: 'bg-blue-500 text-white ring-blue-600',    inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'diseno',     label: 'Diseño de Flujos',  active: 'bg-purple-500 text-white ring-purple-600', inactive: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { key: 'desarrollo', label: 'Desarrollo',        active: 'bg-yellow-500 text-white ring-yellow-600', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { key: 'pruebas',    label: 'Pruebas',           active: 'bg-orange-500 text-white ring-orange-600', inactive: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
  { key: 'entrega',    label: 'Entrega',           active: 'bg-green-500 text-white ring-green-600',   inactive: 'bg-green-50 text-green-600 hover:bg-green-100' },
  { key: 'soporte',    label: 'Soporte',           active: 'bg-slate-600 text-white ring-slate-700',   inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
]

const statuses = [
  { key: 'activo',                     label: 'Activo',                    clickable: true,  active: 'bg-emerald-500 text-white ring-emerald-600', inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
  { key: 'pausado',                    label: 'Pausado',                   clickable: true,  active: 'bg-amber-500 text-white ring-amber-600',     inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
  { key: 'entregado',                  label: 'Entregado',                 clickable: true,  active: 'bg-blue-500 text-white ring-blue-600',       inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'cancelado',                  label: 'Cancelado',                 clickable: true,  active: 'bg-red-500 text-white ring-red-600',         inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
  { key: 'pendiente_especificaciones', label: '⚠️ Pend. Especificaciones', clickable: false, active: 'bg-amber-400 text-white ring-amber-500',     inactive: 'bg-amber-50 text-amber-700 cursor-not-allowed opacity-70' },
]

export default function ProjectPhaseSelector({ projectId, currentPhase, currentStatus, readOnly }: {
  projectId: string; currentPhase: string; currentStatus: string; readOnly?: boolean
}) {
  const [phase, setPhase] = useState(currentPhase)
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const isPending = status === 'pendiente_especificaciones' || currentStatus === 'pendiente_especificaciones'

  useEffect(() => { setPhase(currentPhase) }, [currentPhase])
  useEffect(() => { setStatus(currentStatus) }, [currentStatus])

  async function handlePhaseChange(newPhase: string) {
    if (readOnly || newPhase === phase) return
    // Bloquear si está pendiente de especificaciones
    if (isPending) {
      setError('El proyecto está en espera de respuesta del área comercial. No se puede cambiar la fase hasta que se resuelva.')
      return
    }
    setLoading(true); setError(''); setPhase(newPhase)
    const updates: Record<string, any> = { phase: newPhase }
    if (newPhase === 'entrega') updates.status = 'entregado'
    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(err.message); setPhase(currentPhase) }
    setLoading(false); router.refresh()
  }

  async function handleStatusChange(newStatus: string) {
    if (readOnly || newStatus === status) return
    // Bloquear si está pendiente de especificaciones
    if (isPending) {
      setError('El proyecto está en espera del área comercial. Solo ellos pueden reactivarlo desde el deal vinculado.')
      return
    }
    setLoading(true); setStatus(newStatus)
    const updates: Record<string, any> = { status: newStatus }
    if (newStatus === 'entregado') updates.delivered_at = new Date().toISOString()
    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(err.message); setStatus(currentStatus) }
    setLoading(false); router.refresh()
  }

  return (
    <div className={`rounded-2xl border shadow-sm p-4 space-y-4 ${
      isPending ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fase del proyecto</h2>
        <div className="flex items-center gap-2">
          {isPending && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200">
              <Lock className="w-3 h-3" /> Bloqueado — Pend. Especificaciones
            </div>
          )}
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
        </div>
      </div>

      {/* Aviso de bloqueo */}
      {isPending && (
        <div className="flex items-start gap-2 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Los cambios de fase y estado están <strong>bloqueados</strong> mientras el área comercial no responda las especificaciones pendientes.
          </p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Fase actual</p>
        <div className="flex flex-wrap gap-1.5">
          {phases.map(p => (
            <button key={p.key}
              onClick={() => handlePhaseChange(p.key)}
              disabled={loading || isPending || readOnly}
              title={readOnly ? 'Solo lectura' : isPending ? 'Bloqueado — esperando respuesta de comercial' : undefined}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                phase === p.key ? `${p.active} ring-1` : p.inactive
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Estado</p>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => (
            <button key={s.key}
              onClick={() => (!isPending && s.clickable) ? handleStatusChange(s.key) : (isPending ? setError('Bloqueado — esperando respuesta del área comercial.') : undefined)}
              disabled={loading || readOnly || (!isPending && !s.clickable)}
              title={
                readOnly ? 'Solo lectura'
                : isPending ? 'Bloqueado — esperando respuesta de comercial'
                : !s.clickable ? 'Se gestiona automáticamente desde el flujo de especificaciones'
                : undefined
              }
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
                isPending ? 'opacity-60' : ''
              } ${status === s.key ? `${s.active} ring-1` : s.inactive}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
        </div>
      )}
    </div>
  )
}
