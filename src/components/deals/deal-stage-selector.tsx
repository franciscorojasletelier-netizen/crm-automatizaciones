'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const stages = [
  { key: 'nuevo_lead',        label: 'Nuevo Lead',       color: 'bg-blue-500',   active: 'bg-blue-500 text-white ring-blue-600',   inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'contactado',        label: 'Contactado',        color: 'bg-yellow-500', active: 'bg-yellow-400 text-white ring-yellow-500', inactive: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' },
  { key: 'calificado',        label: 'Calificado',        color: 'bg-purple-500', active: 'bg-purple-500 text-white ring-purple-600', inactive: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { key: 'reunion_agendada',  label: 'Reunión Agendada',  color: 'bg-indigo-500', active: 'bg-indigo-500 text-white ring-indigo-600', inactive: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
  { key: 'reunion_realizada', label: 'Reunión Realizada', color: 'bg-cyan-500',   active: 'bg-cyan-500 text-white ring-cyan-600',   inactive: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada', color: 'bg-orange-500', active: 'bg-orange-500 text-white ring-orange-600', inactive: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
  { key: 'negociacion',       label: 'Negociación',       color: 'bg-pink-500',   active: 'bg-pink-500 text-white ring-pink-600',   inactive: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
  { key: 'cerrado_ganado',    label: 'Ganado ✓',          color: 'bg-green-500',  active: 'bg-green-500 text-white ring-green-600', inactive: 'bg-green-50 text-green-600 hover:bg-green-100' },
  { key: 'cerrado_perdido',   label: 'Perdido',           color: 'bg-red-500',    active: 'bg-red-500 text-white ring-red-600',     inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
  { key: 'no_calificado',     label: 'No Calificado',     color: 'bg-gray-400',   active: 'bg-gray-500 text-white ring-gray-600',   inactive: 'bg-gray-50 text-gray-600 hover:bg-gray-100' },
  { key: 'frio',              label: 'Frío',              color: 'bg-slate-400',  active: 'bg-slate-500 text-white ring-slate-600', inactive: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

const closedStages = ['cerrado_ganado', 'cerrado_perdido', 'no_calificado']

export default function DealStageSelector({ dealId, currentStage }: { dealId: string; currentStage: string }) {
  const [stage, setStage] = useState(currentStage)
  useEffect(() => { setStage(currentStage) }, [currentStage])
  const [loading, setLoading] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [showLostReason, setShowLostReason] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleStageChange(newStage: string) {
    if (newStage === stage) return
    if (newStage === 'cerrado_perdido') { setShowLostReason(true); setStage(newStage); return }
    await applyStageChange(newStage, null)
  }

  async function applyStageChange(newStage: string, reason: string | null) {
    setLoading(true)
    setError('')
    const updates: Record<string, any> = { stage: newStage }
    if (closedStages.includes(newStage)) updates.status = newStage === 'cerrado_ganado' ? 'won' : 'lost'
    if (reason) updates.lost_reason = reason

    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals').update(updates).eq('id', dealId).select('company_id, estimated_value, owner_id').single()

    if (updateError) { setError(updateError.message); setStage(currentStage); setLoading(false); return }

    if (newStage === 'cerrado_ganado' && updatedDeal) {
      await supabase.from('projects').insert({
        company_id: updatedDeal.company_id, deal_id: dealId, owner_id: updatedDeal.owner_id,
        name: `Proyecto - ${new Date().toLocaleDateString('es-CL')}`,
        phase: 'discovery', status: 'activo', budget: updatedDeal.estimated_value,
        start_date: new Date().toISOString().split('T')[0],
      })
    }

    setLoading(false)
    setShowLostReason(false)
    router.refresh()
  }

  const activeStage = stages.find(s => s.key === stage)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambiar etapa</h2>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {stages.map(s => (
          <button key={s.key} onClick={() => handleStageChange(s.key)} disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
              stage === s.key ? `${s.active} ring-1` : s.inactive
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}

      {showLostReason && (
        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-800">¿Por qué se perdió este deal?</p>
          </div>
          <select value={lostReason} onChange={e => setLostReason(e.target.value)}
            className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400">
            <option value="">Seleccionar motivo</option>
            <option value="precio">Precio</option>
            <option value="competencia">Competencia</option>
            <option value="sin_urgencia">Sin urgencia</option>
            <option value="contacto_no_decisor">Contacto no decisor</option>
            <option value="proyecto_cancelado">Proyecto cancelado</option>
            <option value="negociacion_prolongada">Negociación prolongada</option>
            <option value="otro">Otro</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => applyStageChange('cerrado_perdido', lostReason)} disabled={!lostReason || loading}
              className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Confirmar pérdida
            </button>
            <button onClick={() => { setShowLostReason(false); setStage(currentStage) }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
