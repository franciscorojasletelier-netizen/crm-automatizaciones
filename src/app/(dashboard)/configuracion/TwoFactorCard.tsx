'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'unenrolled' | 'enrolling' | 'enrolled'

export default function TwoFactorCard({ mfaRequired = false }: { mfaRequired?: boolean }) {
  const [status, setStatus] = useState<Status>('loading')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp.find(f => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        setStatus('enrolled')
        return
      }
      // Factores abandonados a medias (enrolados pero nunca verificados)
      // bloquean un enroll() nuevo — se limpian antes de mostrar el botón.
      // El SDK tipa `data.totp` como siempre 'verified' (no refleja los
      // no verificados en su tipo), así que hay que revisar `data.all`.
      const unverified = (data?.all ?? []).filter(f => f.factor_type === 'totp' && f.status === 'unverified')
      await Promise.all(unverified.map(f => supabase.auth.mfa.unenroll({ factorId: f.id })))
      setStatus('unenrolled')
    }
    load()
  }, [supabase])

  async function startEnroll() {
    setError('')
    setSaving(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    setSaving(false)
    if (error || !data) {
      setError('No se pudo iniciar la activación. Probá de nuevo.')
      return
    }
    setFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setStatus('enrolling')
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || saving) return
    setSaving(true)
    setError('')

    let cid = challengeId
    if (!cid) {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error || !challenge.data) {
        setSaving(false)
        setError('No se pudo generar el desafío. Probá de nuevo.')
        return
      }
      cid = challenge.data.id
      setChallengeId(cid)
    }

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: cid, code: code.trim() })
    setSaving(false)

    if (error) {
      setError('Código incorrecto. Volvé a intentarlo.')
      const retry = await supabase.auth.mfa.challenge({ factorId })
      setChallengeId(retry.data?.id ?? '')
      setCode('')
      return
    }

    setStatus('enrolled')
    setCode('')
  }

  async function cancelEnroll() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId })
    setFactorId(''); setQrCode(''); setSecret(''); setCode(''); setChallengeId(''); setError('')
    setStatus('unenrolled')
  }

  async function disable() {
    if (!factorId || saving) return
    setSaving(true)
    setError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setSaving(false)
    if (error) { setError('No se pudo desactivar. Probá de nuevo.'); return }
    setFactorId('')
    setStatus('unenrolled')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Doble factor de autenticación</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        {mfaRequired && status !== 'enrolled' && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Tu organización exige doble factor para poder usar el CRM. Activalo para continuar.</p>
          </div>
        )}

        {status === 'loading' && <p className="text-sm text-slate-400">Cargando...</p>}

        {status === 'unenrolled' && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">Sin activar</p>
              <p className="text-xs text-slate-500 mt-0.5">Agregá una capa extra de seguridad con una app de autenticación (Google Authenticator, Authy, etc.).</p>
            </div>
            <button onClick={startEnroll} disabled={saving}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg disabled:opacity-60"
              style={{ background: saving ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Activar'}
            </button>
          </div>
        )}

        {status === 'enrolling' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Abrí tu app de autenticación (Google Authenticator, Authy, etc.) y usá su opción para escanear un código QR — <span className="font-semibold text-slate-600">no la cámara normal del teléfono</span>, que solo va a mostrar texto. Si preferís, ingresá la clave manualmente.</p>
            {qrCode && (
              <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                {/* qr_code ya viene como data URI completa (data:image/svg+xml;...) */}
                <img src={qrCode} alt="Código QR para activar 2FA" className="w-40 h-40" />
              </div>
            )}
            {secret && (
              <p className="text-[11px] text-slate-400 text-center font-mono break-all">{secret}</p>
            )}
            <form onSubmit={confirmEnroll} className="space-y-2.5">
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus placeholder="000000"
                className="w-full text-center tracking-[0.5em] text-base font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 placeholder:text-slate-300 placeholder:tracking-[0.5em]"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={saving || code.length !== 6}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg disabled:opacity-60"
                  style={{ background: saving ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                </button>
                <button type="button" onClick={cancelEnroll} disabled={saving}
                  className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {status === 'enrolled' && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">Activado</p>
                <p className="text-xs text-slate-500 mt-0.5">Tu cuenta pide un código extra al iniciar sesión.</p>
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
              </div>
            </div>
            <button onClick={disable} disabled={saving}
              className="shrink-0 text-xs font-semibold text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desactivar'}
            </button>
          </div>
        )}

        {error && status !== 'enrolling' && status !== 'enrolled' && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-xs font-medium text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
