'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Zap, ShieldCheck, AlertCircle } from 'lucide-react'

export default function VerifyMfaForm() {
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function prepare() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      const factor = data?.totp.find(f => f.status === 'verified')
      if (error || !factor) {
        setError('No se encontró un factor de verificación activo para esta cuenta.')
        setPreparing(false)
        return
      }
      setFactorId(factor.id)
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challenge.error) {
        setError('No se pudo iniciar la verificación. Probá de nuevo.')
        setPreparing(false)
        return
      }
      setChallengeId(challenge.data.id)
      setPreparing(false)
    }
    prepare()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || !challengeId || loading) return
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() })

    if (error) {
      setLoading(false)
      setError('Código incorrecto. Volvé a intentarlo.')
      // El challenge ya se consumió — hay que pedir uno nuevo para el
      // próximo intento, si no, verify() vuelve a fallar aunque el
      // código sea correcto.
      const retry = await supabase.auth.mfa.challenge({ factorId })
      if (!retry.error) setChallengeId(retry.data.id)
      setCode('')
      return
    }

    window.location.href = '/dashboard'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg">CRM</span>
            <span className="text-indigo-300 text-sm font-normal ml-1">Automatizaciones</span>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white leading-tight">Un paso más<br />para entrar</h2>
        </div>
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 CRM Automatizaciones</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">CRM <span className="font-normal text-slate-400 text-sm">Automatizaciones</span></span>
          </div>

          <div className="mb-8">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verificación en dos pasos</h1>
            <p className="text-slate-500 mt-1 text-sm">Ingresá el código de 6 dígitos de tu app de autenticación.</p>
          </div>

          {preparing ? (
            <p className="text-sm text-slate-400">Preparando verificación...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Código</label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus required disabled={!challengeId}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] text-lg font-semibold px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-300 placeholder:tracking-[0.5em] text-slate-900 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit" disabled={loading || !challengeId || code.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-60 transition-all mt-2"
                style={{ background: loading ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
            </form>
          )}

          <div className="pt-6 mt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">¿Perdiste el acceso a tu app de autenticación? Contactá al administrador de tu organización para que desactive tu factor.</p>
            <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
