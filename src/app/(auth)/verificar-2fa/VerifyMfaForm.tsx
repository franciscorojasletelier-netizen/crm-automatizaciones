'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { AuthError } from '@/components/auth/auth-shell'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'

export default function VerifyMfaForm() {
  const [supabase] = useState(() => createClient())
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function prepare() {
      const { data, error: err } = await supabase.auth.mfa.listFactors()
      const factor = data?.totp.find(f => f.status === 'verified')
      if (err || !factor) {
        setError('No se encontró un factor de verificación activo para esta cuenta.')
        setPreparing(false)
        return
      }
      setFactorId(factor.id)
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challenge.error) {
        setError('No se pudo iniciar la verificación. Inténtalo de nuevo.')
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
    const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() })
    if (err) {
      setLoading(false)
      setError('Código incorrecto. Revisa tu app y vuelve a intentarlo.')
      // El desafío ya se consumió: sin uno nuevo, el siguiente intento falla aunque el código sea correcto.
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
    <AuthShell title="Verificación en dos pasos" description="Ingresa el código de 6 dígitos de tu app de autenticación."
      footer={
        <>
          <p className="mb-2">¿Perdiste acceso a tu app? Pide a un administrador de tu organización que desactive tu factor.</p>
          <button onClick={handleLogout} className="text-accent-700 hover:underline">Cerrar sesión</button>
        </>
      }>
      {preparing ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Preparando verificación…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="mfa-code" className={labelClass}>Código</label>
            <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required disabled={!challengeId}
              placeholder="000000" className={`${inputClass} h-11 text-center text-lg font-medium tracking-[0.4em] tabular-nums`} />
          </div>
          {error && <AuthError>{error}</AuthError>}
          <button type="submit" disabled={loading || !challengeId || code.length !== 6} className={`${buttonClass.primary} w-full h-9`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Verificando…' : 'Verificar'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
