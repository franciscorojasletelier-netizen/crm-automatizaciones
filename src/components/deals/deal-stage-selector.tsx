'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight } from 'lucide-react'

const stages = [
  { key: 'nuevo_lead', label: 'Nuevo Lead' },
  { key: 'contactado', label: 'Contactado' },
  { key: 'calificado', label: 'Calificado' },
  { key: 'reunion_agendada', label: 'Reunión Agendada' },
  { key: 'reunion_realizada', label: 'Reunión Realizada' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'cerrado_ganado', label: 'Cerrado Ganado' },
  { key: 'cerrado_perdido', label: 'Cerrado Perdido' },
  { key: 'no_calificado', label: 'No Calificado' },
  { key: 'frio', label: 'Frío' },
]

const closedStages = ['cerrado_ganado', 'cerrado_perdido', 'no_calificado']

export default function DealStageSelector({
  dealId,
  currentStage,
}: {
  dealId: string
  currentStage: string
}) {
  const [stage, setStage] = useState(currentStage)
  const [loading, setLoading] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [showLostReason, setShowLostReason] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleStageChange(newStage: string) {
    if (newStage === stage) return

    if (newStage === 'cerrado_perdido') {
      setShowLostReason(true)
      setStage(newStage)
      return
    }

    await applyStageChange(newStage, null)
  }

  async function applyStageChange(newStage: string, reason: string | null) {
    setLoading(true)
    const updates: Record<string, any> = { stage: newStage }
    if (closedStages.includes(newStage)) {
      updates.status = newStage === 'cerrado_ganado' ? 'won' : 'lost'
    }
    if (reason) updates.lost_reason = reason

    await supabase.from('deals').update(updates).eq('id', dealId)
    setLoading(false)
    setShowLostReason(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cambiar etapa</h2>

      <div className="flex flex-wrap gap-2">
        {stages.map(s => (
          <button
            key={s.key}
            onClick={() => handleStageChange(s.key)}
            disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              stage === s.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Modal razón de pérdida */}
      {showLostReason && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200 space-y-3">
          <p className="text-sm font-medium text-red-800">¿Por qué se perdió este deal?</p>
          <select
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white"
          >
            <option value="">Seleccionar motivo</option>
            <option value="precio">Precio</option>
            <option value="competencia">Competencia</option>
            <option value="sin_urgencia">Sin urgencia</option>
            <option value="contacto_no_decisor">Contacto no decisor</option>
            <option value="proyecto_cancelado">Proyecto cancelado</option>
            <option value="negociacion_prolongada">Negociación prolongada sin acuerdo</option>
            <option value="otro">Otro</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => applyStageChange('cerrado_perdido', lostReason)}
              disabled={!lostReason || loading}
              className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar pérdida
            </button>
            <button
              onClick={() => { setShowLostReason(false); setStage(currentStage) }}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
