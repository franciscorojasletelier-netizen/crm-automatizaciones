'use client'

import { useState } from 'react'
import { Shield, Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  email: string
}

export default function ChangePasswordCard({ email }: Props) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSend() {
    if (!email || loading) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })
    setLoading(false)
    if (error) { setError('No se pudo enviar el enlace. Probá de nuevo.'); return }
    setSent(true)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Shield className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Seguridad</h2>
      </div>
      <div className="px-5 py-4">
        {sent ? (
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Enlace enviado</p>
              <p className="text-xs text-emerald-700 mt-0.5">Revisá {email} para elegir una nueva contraseña.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">Cambiar contraseña</p>
                <p className="text-xs text-slate-500 mt-0.5">Te enviamos un enlace a tu correo para elegir una nueva.</p>
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
              </div>
            </div>
            <button onClick={handleSend} disabled={loading}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg disabled:opacity-60"
              style={{ background: loading ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enviar enlace'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
