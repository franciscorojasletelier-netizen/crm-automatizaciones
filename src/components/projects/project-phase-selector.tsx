'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const phases = [
  { key: 'discovery', label: 'Discovery' },
  { key: 'diseno', label: 'Diseño de Flujos' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'pruebas', label: 'Pruebas' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'soporte', label: 'Soporte' },
]

const statuses = [
  { key: 'activo', label: 'Activo' },
  { key: 'pausado', label: 'Pausado' },
  { key: 'entregado', label: 'Entregado' },
  { key: 'cancelado', label: 'Cancelado' },
]

export default function ProjectPhaseSelector({
  projectId,
  currentPhase,
  currentStatus,
}: {
  projectId: string
  currentPhase: string
  currentStatus: string
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
    setLoading(true)
    setError('')
    setPhase(newPhase)

    const updates: Record<string, any> = { phase: newPhase }
    if (newPhase === 'entrega') updates.status = 'entregado'

    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(`Error: ${err.message}`); setPhase(currentPhase) }
    setLoading(false)
    router.refresh()
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) return
    setLoading(true)
    setStatus(newStatus)

    const updates: Record<string, any> = { status: newStatus }
    if (newStatus === 'entregado') updates.delivered_at = new Date().toISOString()

    const { error: err } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (err) { setError(`Error: ${err.message}`); setStatus(currentStatus) }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fase del proyecto</h2>
        <div className="flex flex-wrap gap-2">
          {phases.map(p => (
            <button key={p.key} onClick={() => handlePhaseChange(p.key)} disabled={loading}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                phase === p.key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <button key={s.key} onClick={() => handleStatusChange(s.key)} disabled={loading}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                status === s.key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
