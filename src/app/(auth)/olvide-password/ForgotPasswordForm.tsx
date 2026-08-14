'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Zap, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })

    setLoading(false)
    // Siempre mostramos éxito, exista o no la cuenta — no revelamos
    // qué emails están registrados en el sistema.
    if (error) {
      setError('No se pudo enviar el correo. Probá de nuevo en unos minutos.')
      return
    }
    setSent(true)
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
          <h2 className="text-3xl font-bold text-white leading-tight">Recuperá el acceso<br />a tu cuenta</h2>
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

          {sent ? (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Revisá tu correo</h1>
              <p className="text-slate-500 text-sm">
                Si <span className="font-semibold text-slate-700">{email}</span> tiene una cuenta en este sistema, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos en llegar.
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">¿Olvidaste tu contraseña?</h1>
                <p className="text-slate-500 mt-1 text-sm">Ingresá tu email y te mandamos un enlace para restablecerla.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="tu@empresa.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 text-slate-900 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-60 transition-all mt-2"
                  style={{ background: loading ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>

                <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors pt-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver al login
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
