'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const phases = [
  { key: 'discovery', label: 'Discovery',         active: 'bg-blue-500 text-white ring-blue-600',   inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'diseno',    label: 'Diseño de Flujos',   active: 'bg-purple-500 text-white ring-purple-600', inactive: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { key: 'desarrollo',label: 'Desarrollo',         active: 'bg-yellow-500 text-white ring-yellow-600', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { key: 'pruebas',   label: 'Pruebas',            active: 'bg-orange-500 text-white ring-orange-600', inactive: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
  { key: 'entrega',   label: 'Entrega',            active: 'bg-green-500 text-white ring-green-600',  inactive: 'bg-green-50 text-green-600 hover:bg-green-100' },
  { key: 'soporte',   label: 'Soporte',            active: 'bg-slate-600 text-white ring-slate-700',  inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
]

const statuses = [
  { key: 'activo',                     label: 'Activo',                     clickable: true,  active: 'bg-emerald-500 text-white ring-emerald-600', inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
  { key: 'pausado',                    label: 'Pausado',                    clickable: true,  active: 'bg-amber-500 text-white ring-amber-600',     inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
  { key: 'entregado',                  label: 'Entregado',                  clickable: true,  active: 'bg-blue-500 text-white ring-blue-600',       inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'cancelado',                  label: 'Cancelado',                  clickable: true,  active: 'bg-red-500 text-white ring-red-600',         inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
  { key: 'pendiente_especificaciones', label: '⚠️ Pend. Especificaciones', clickable: false, active: 'bg-amber-400 text-white ring-amber-500',     inactive: 'bg-amber-50 text-amber-700 cursor-default opacity-70' },
]

export default function ProjectPhaseSelector({ projectId, currentPhase, currentStatus }: {
  projectId: string; currentPhase: string; currentStatus: string
}) {
  const [phase, setPhase] = useState(currentPhase)
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { setPhase(currentPhase) }, [currentPhase])
  useEffect(() => { setStatus(currentStatus) }, [currentStatus])

  async function handlePhaseChange(newPhase: string) {
    if (newPhase === phase) return
    setLoading(true); setError(''); setPhase(newPhase)
    const updates: Record<string, any> = { phase: newPhase }
    if (newPhase === 'entrega') updates.status = 'entregado'
    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(err.message); setPhase(currentPhase) }
    setLoading(false); router.refresh()
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) return
    setLoading(true); setStatus(newStatus)
    const updates: Record<string, any> = { status: newStatus }
    if (newStatus === 'entregado') updates.delivered_at = new Date().toISOString()
    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(err.message); setStatus(currentStatus) }
    setLoading(false); router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fase del proyecto</h2>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Fase actual</p>
        <div className="flex flex-wrap gap-1.5">
          {phases.map(p => (
            <button key={p.key} onClick={() => handlePhaseChange(p.key)} disabled={loading}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
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
              onClick={() => s.clickable ? handleStatusChange(s.key) : undefined}
              disabled={loading || !s.clickable}
              title={!s.clickable ? 'Gestionar desde el botón "Devolver a Comercial"' : undefined}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
                status === s.key ? `${s.active} ring-1` : s.inactive
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}
    </div>
  )
}
