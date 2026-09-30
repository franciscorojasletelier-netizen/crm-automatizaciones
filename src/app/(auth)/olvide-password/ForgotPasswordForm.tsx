'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { AuthError } from '@/components/auth/auth-shell'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })
    setLoading(false)
    // Se muestra éxito exista o no la cuenta: no se revela qué emails están registrados.
    if (err) { setError('No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.'); return }
    setSent(true)
  }

  const back = <Link href="/login" className="text-accent-700 hover:underline">Volver a iniciar sesión</Link>

  if (sent) {
    return (
      <AuthShell title="Revisa tu correo" footer={back}>
        <div className="flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">
            Si <span className="font-medium text-slate-900">{email}</span> tiene una cuenta, te enviamos un enlace para
            restablecer la contraseña. Puede tardar unos minutos; revisa también la carpeta de spam.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Recuperar contraseña" description="Te enviaremos un enlace para crear una nueva." footer={back}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fp-email" className={labelClass}>Email</label>
          <input id="fp-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="tu@empresa.cl" className={inputClass} />
        </div>
        {error && <AuthError>{error}</AuthError>}
        <button type="submit" disabled={loading} className={`${buttonClass.primary} w-full h-9`}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </AuthShell>
  )
}
