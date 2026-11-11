'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'

// Borra una empresa sin negocios, cobranza ni proyectos (la función
// delete_company_if_empty lo vuelve a validar en la base y deja registro).
export default function DeleteCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError('')
    const { error } = await createClient().rpc('delete_company_if_empty', { p_company_id: companyId })
    if (error) {
      setError(friendlyError(error.message, 'No se pudo eliminar la empresa'))
      setLoading(false)
      return
    }
    router.push('/empresas')
    router.refresh()
  }

  if (confirming) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        <span className="text-xs font-semibold text-red-700">{error || `¿Eliminar ${companyName} y sus contactos?`}</span>
        <button type="button" onClick={handleDelete} disabled={loading}
          className="flex items-center gap-1 text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
        <button type="button" aria-label="Cancelar" onClick={() => { setConfirming(false); setError('') }}
          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-all">
      <Trash2 className="w-4 h-4" />
      Eliminar empresa
    </button>
  )
}
