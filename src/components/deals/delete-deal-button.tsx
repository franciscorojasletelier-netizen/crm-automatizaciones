'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'

export default function DeleteDealButton({ dealId, companyId, contactId }: {
  dealId: string; companyId: string; contactId: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()
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
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        <span className="text-xs font-semibold text-red-700">¿Eliminar todo?</span>
        <button onClick={handleDelete} disabled={loading}
          className="flex items-center gap-1 text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {loading ? 'Eliminando...' : 'Sí, eliminar'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-all">
      <Trash2 className="w-4 h-4" />
      <span className="hidden sm:inline">Eliminar</span>
    </button>
  )
}
