'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/pg-error'
import AuthShell, { AuthError } from '@/components/auth/auth-shell'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'

const MIN_LENGTH = 8

export default function ResetPasswordForm() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const readyRef = useRef(false)

  useEffect(() => {
    // El enlace de recuperación pone el token en el hash de la URL; el
    // cliente lo procesa y dispara PASSWORD_RECOVERY con una sesión temporal.
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { readyRef.current = true; setReady(true) }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { readyRef.current = true; setReady(true) }
    })
    const timeout = setTimeout(() => { if (!readyRef.current) setInvalid(true) }, 4000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout) }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) { setError(`Usa al menos ${MIN_LENGTH} caracteres.`); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(friendlyError(err.message)); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (invalid && !ready) {
    return (
      <AuthShell title="Enlace inválido o vencido" description="Por seguridad, los enlaces de recuperación expiran."
        footer={<Link href="/olvide-password" className="text-accent-700 hover:underline">Solicitar un nuevo enlace</Link>}>
        <p className="text-sm text-slate-600">Pide uno nuevo y ábrelo desde el mismo navegador.</p>
      </AuthShell>
    )
  }
  if (done) {
    return (
      <AuthShell title="Contraseña actualizada">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Te llevamos a tu panel…
        </p>
      </AuthShell>
    )
  }
  if (!ready) {
    return (
      <AuthShell title="Verificando enlace">
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Un momento…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Nueva contraseña" description={`Mínimo ${MIN_LENGTH} caracteres.`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="rp-pass" className={labelClass}>Nueva contraseña</label>
          <input id="rp-pass" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="rp-confirm" className={labelClass}>Confirmar contraseña</label>
          <input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={inputClass} />
        </div>
        {error && <AuthError>{error}</AuthError>}
        <button type="submit" disabled={loading} className={`${buttonClass.primary} w-full h-9`}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthShell>
  )
}
