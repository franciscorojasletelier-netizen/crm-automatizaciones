'use client'

import { useState } from 'react'
import { KeyRound, Loader2, Check } from 'lucide-react'

interface Props {
  userId: string
}

export default function ResetPasswordButton({ userId }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    if (loading) return
    if (!confirm('¿Enviar un enlace para restablecer la contraseña de este usuario?')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar el enlace')
        setLoading(false)
        return
      }
      setDone(true)
      setLoading(false)
      setTimeout(() => setDone(false), 3000)
    } catch {
      setError('No se pudo conectar')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={error || 'Enviar enlace de restablecimiento de contraseña'}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
        done ? 'bg-emerald-50 text-emerald-600' : error ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
    </button>
  )
}
