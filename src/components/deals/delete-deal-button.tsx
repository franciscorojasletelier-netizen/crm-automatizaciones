'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'

export default function DeleteDealButton({ dealId, companyId, contactId }: {
  dealId: string
  companyId: string
  contactId: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()

    // Eliminar interacciones, tareas, historial, deal, contacto y empresa
    await supabase.from('interactions').delete().eq('deal_id', dealId)
    await supabase.from('tasks').delete().eq('deal_id', dealId)
    await supabase.from('pipeline_stage_history').delete().eq('deal_id', dealId)
    await supabase.from('deals').delete().eq('id', dealId)
    await supabase.from('contacts').delete().eq('id', contactId)
    await supabase.from('companies').delete().eq('id', companyId)

    router.push('/leads')
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">¿Eliminar este lead?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Eliminando...' : 'Sí, eliminar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      Eliminar
    </button>
  )
}
