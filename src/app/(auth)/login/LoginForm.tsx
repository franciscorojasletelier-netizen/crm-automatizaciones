'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { AuthError } from '@/components/auth/auth-shell'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'

// Motivos por los que el proxy devuelve a alguien al login.
const REDIRECT_REASONS: Record<string, string> = {
  inactive: 'Tu cuenta está desactivada. Pide a un administrador de tu organización que la reactive.',
}

export default function LoginForm({ reason }: { reason?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(reason ? REDIRECT_REASONS[reason] ?? '' : '')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Respuesta inesperada del servidor')
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Email o contraseña incorrectos')
        setLoading(false)
        return
      }

      // Con un factor de 2FA verificado la sesión queda en AAL1 hasta
      // completar el desafío: sin este chequeo se saltaría el 2FA.
      const supabase = createClient()
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const needsMfaChallenge = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel

      // Recarga completa para que el resto de la app lea la cookie de sesión recién creada
      window.location.href = needsMfaChallenge ? '/verificar-2fa' : '/dashboard'
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Iniciar sesión" description="Ingresa con el email de tu cuenta.">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="login-email" className={labelClass}>Email</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="tu@empresa.cl" className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="text-[13px] font-medium text-slate-700">Contraseña</label>
            <Link href="/olvide-password" className="text-[13px] text-accent-700 hover:underline">¿La olvidaste?</Link>
          </div>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
            required className={inputClass} />
        </div>

        {error && <AuthError>{error}</AuthError>}

        <button type="submit" disabled={loading} className={`${buttonClass.primary} w-full h-9`}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  )
}
