'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import { Zap, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const readyRef = useRef(false)

  useEffect(() => {
    // El enlace de recuperación de Supabase pone el token en el hash de la
    // URL; el cliente lo procesa solo y dispara este evento con una sesión
    // temporal válida únicamente para cambiar la contraseña.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { readyRef.current = true; setReady(true) }
    })
    // Si el evento ya disparó antes de montar este componente, la sesión
    // ya está activa — lo confirmamos igual.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { readyRef.current = true; setReady(true) }
    })
    const timeout = setTimeout(() => { if (!readyRef.current) setInvalid(true) }, 4000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(friendlyError(error.message)); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">CRM <span className="font-normal text-slate-400 text-sm">Automatizaciones</span></span>
        </div>

        {invalid && !ready ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Enlace inválido o vencido</h1>
            <p className="text-slate-500 text-sm">Los enlaces de recuperación expiran por seguridad. Pedí uno nuevo.</p>
            <Link href="/olvide-password" className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Contraseña actualizada</h1>
            <p className="text-slate-500 text-sm">Te estamos llevando a tu panel...</p>
          </div>
        ) : !ready ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando enlace...
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Elegí una nueva contraseña</h1>
              <p className="text-slate-500 mt-1 text-sm">Mínimo 6 caracteres.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 text-slate-900 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 text-slate-900 transition-all" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-60 transition-all mt-2"
                style={{ background: loading ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
