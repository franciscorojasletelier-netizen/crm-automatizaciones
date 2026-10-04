'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check, RefreshCw, Copy, UserPlus, Mail, KeyRound, ImagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadOrgLogo, validateLogo } from '@/lib/org-logo'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { PLANS, type PlanKey } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { CURRENCIES } from '@/lib/money'

function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

export default function NewOrganizationForm({ canInvite }: { canInvite: boolean }) {
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<PlanKey>('profesional')
  const [invite, setInvite] = useState(canInvite)
  const [password, setPassword] = useState(genPassword())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ orgId: string; invited: boolean; planWarning?: string; profileWarning?: string } | null>(null)
  // Datos de la empresa (opcionales): van en correos, estados de cuenta y cotizaciones.
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [profile, setProfile] = useState({ email: '', phone: '', address: '', payment_instructions: '', currency: 'CLP' })
  const fileRef = useRef<HTMLInputElement>(null)
  const logoPreview = useObjectUrl(logoFile)
  const setP = (k: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setProfile(p => ({ ...p, [k]: e.target.value }))

  function pickLogo(file: File | undefined) {
    if (!file) return
    const invalid = validateLogo(file)
    if (invalid) { setError(invalid); return }
    setError(''); setLogoFile(file)
  }

  function reset() {
    setOrgName(''); setFullName(''); setEmail(''); setPassword(genPassword()); setPlan('profesional')
    setLogoFile(null); setProfile({ email: '', phone: '', address: '', payment_instructions: '', currency: 'CLP' })
    setError(''); setDone(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError('')
    if (!orgName.trim())  { setError('Falta el nombre de la organización.'); return }
    if (!fullName.trim()) { setError('Falta el nombre del administrador.'); return }
    if (!email.trim())    { setError('Falta el correo del administrador.'); return }
    if (!invite && password.length < 8) { setError('La contraseña temporal debe tener al menos 8 caracteres.'); return }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) { setError('El correo de contacto de la empresa no es válido.'); return }

    setSaving(true)
    const res = await fetch('/api/platform/create-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, fullName, email, plan, invite, password: invite ? undefined : password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setSaving(false); setError(data.error ?? 'No se pudo crear la organización.'); return }

    // Datos de la empresa y logo: la organización ya existe; un fallo acá no
    // deshace el alta (se completa desde la ficha).
    const orgId: string = data.organizationId
    const sb = createClient()
    const warnings: string[] = []
    const clean = (v: string) => v.trim() || null
    const fields = { email: clean(profile.email), phone: clean(profile.phone), address: clean(profile.address), payment_instructions: clean(profile.payment_instructions) }
    if (Object.values(fields).some(Boolean) || profile.currency !== 'CLP') {
      const { error: upErr } = await sb.from('organizations').update({ ...fields, currency: profile.currency }).eq('id', orgId)
      if (upErr) warnings.push(`datos de contacto (${upErr.message})`)
    }
    if (logoFile) {
      const up = await uploadOrgLogo(sb, orgId, logoFile)
      if ('error' in up) warnings.push(`logo (${up.error})`)
    }
    setSaving(false)
    setDone({ orgId, invited: !!data.invited, planWarning: data.planWarning, profileWarning: warnings.length ? warnings.join(', ') : undefined })
  }

  if (done) {
    return (
      <div className="bg-card rounded-lg border border-slate-200 shadow-xs p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
          <Check className="w-5 h-5 text-emerald-700" />
        </div>
        <p className="text-sm font-semibold text-slate-900">{orgName} quedó creada · plan {PLANS[plan].label}</p>
        {done.invited ? (
          <p className="text-[13px] text-slate-600">Enviamos la invitación a <span className="font-medium">{email}</span> para que defina su contraseña.</p>
        ) : invite ? (
          <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            La cuenta se creó, pero la invitación no salió. Desde Equipo puedes enviarle un enlace para restablecer la contraseña.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-slate-600">Comparte estas credenciales con el administrador:</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-[13px] space-y-1">
              <p><span className="text-slate-500">Correo:</span> {email}</p>
              <p className="flex items-center gap-2">
                <span><span className="text-slate-500">Contraseña:</span> <span className="font-mono">{password}</span></span>
                <button type="button" onClick={() => navigator.clipboard?.writeText(`Correo: ${email}\nContraseña: ${password}`)}
                  className="text-accent-700 hover:text-accent-800" aria-label="Copiar credenciales"><Copy className="w-3.5 h-3.5" /></button>
              </p>
            </div>
          </>
        )}
        {done.planWarning && <p className="text-xs text-amber-800">No se pudo aplicar el plan: {done.planWarning}. Ajústalo en la ficha.</p>}
        {done.profileWarning && <p className="text-xs text-amber-800">No se guardó: {done.profileWarning}. Complétalo en la ficha de la organización.</p>}
        <div className="flex justify-center gap-2 pt-1">
          <Link href={`/plataforma/${done.orgId}`} className={buttonClass.secondary}>Configurar organización</Link>
          <button type="button" onClick={reset} className={buttonClass.ghost}>Crear otra</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-card rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
      <div>
        <label htmlFor="no-org" className={labelClass}>Nombre de la organización</label>
        <input id="no-org" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ej.: Kovacs SpA" className={inputClass} />
      </div>

      <fieldset>
        <legend className={labelClass}>Plan</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {(['basico', 'profesional', 'empresa'] as PlanKey[]).map(k => (
            <button key={k} type="button" role="radio" aria-checked={plan === k} onClick={() => setPlan(k)}
              className={cn('text-left rounded-lg border px-3 py-2 transition-colors', plan === k ? 'border-accent-400 bg-accent-50' : 'border-slate-200 hover:bg-slate-50')}>
              <span className="block text-[13px] font-medium text-slate-900">{PLANS[k].label}</span>
              <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{PLANS[k].maxUsers ? `Hasta ${PLANS[k].maxUsers} usuarios` : 'Usuarios ilimitados'}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{PLANS[plan].description}</p>
      </fieldset>

      <div className="pt-3 border-t border-slate-100 space-y-3">
        <div>
          <p className="text-[13px] font-medium text-slate-700">Datos de la empresa <span className="font-normal text-slate-500">(opcional)</span></p>
          <p className="text-xs text-slate-500">Aparecen en los correos de cobranza, estados de cuenta y cotizaciones. El cliente puede cambiarlos después en Configuración.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28 h-14 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
            {logoPreview ? <img src={logoPreview} alt="Vista previa del logo" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-slate-400">Sin logo</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
            onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = '' }} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className={buttonClass.secondary}>
              <ImagePlus className="w-3.5 h-3.5" /> {logoFile ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logoFile && (
              <button type="button" onClick={() => setLogoFile(null)} className={buttonClass.ghost} aria-label="Quitar logo"><X className="w-3.5 h-3.5" /></button>
            )}
            <p className="basis-full text-xs text-slate-500">PNG, JPG o WebP, hasta 512 KB.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="no-cemail" className={labelClass}>Correo de contacto</label>
            <input id="no-cemail" type="email" value={profile.email} onChange={setP('email')} placeholder="cobranza@empresa.cl" className={inputClass} />
          </div>
          <div>
            <label htmlFor="no-cphone" className={labelClass}>Teléfono</label>
            <input id="no-cphone" value={profile.phone} onChange={setP('phone')} placeholder="+56 2 2345 6789" className={inputClass} />
          </div>
          <div>
            <label htmlFor="no-caddr" className={labelClass}>Dirección</label>
            <input id="no-caddr" value={profile.address} onChange={setP('address')} className={inputClass} />
          </div>
        </div>
        <div className="sm:w-1/3">
          <label htmlFor="no-ccur" className={labelClass}>Moneda</label>
          <select id="no-ccur" value={profile.currency} onChange={setP('currency')} className={inputClass}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="no-cpay" className={labelClass}>Cómo pagar</label>
          <textarea id="no-cpay" value={profile.payment_instructions} onChange={setP('payment_instructions')} rows={3} maxLength={1000}
            placeholder={'Banco · tipo y número de cuenta · razón social · RUT\nCorreo para enviar comprobantes'}
            className={cn(inputClass, 'h-auto py-2 leading-relaxed resize-y')} />
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-4">
        <p className="text-[13px] font-medium text-slate-700">Administrador de la organización</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="no-name" className={labelClass}>Nombre completo</label>
            <input id="no-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej.: María González" className={inputClass} />
          </div>
          <div>
            <label htmlFor="no-email" className={labelClass}>Correo</label>
            <input id="no-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.cl" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100" role="radiogroup" aria-label="Acceso inicial">
          <button type="button" role="radio" aria-checked={invite} disabled={!canInvite} onClick={() => setInvite(true)}
            className={cn('h-8 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50',
              invite ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-600')}>
            <Mail className="w-3.5 h-3.5" /> Invitar por correo
          </button>
          <button type="button" role="radio" aria-checked={!invite} onClick={() => setInvite(false)}
            className={cn('h-8 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5',
              !invite ? 'bg-card text-slate-900 shadow-xs' : 'text-slate-600')}>
            <KeyRound className="w-3.5 h-3.5" /> Contraseña temporal
          </button>
        </div>
        {!canInvite && (
          <p className="text-xs text-slate-500">La invitación por correo se habilita al activar el correo del sistema (Resend).</p>
        )}
        {invite ? (
          <p className="text-xs text-slate-500">Le llega un correo para definir su propia contraseña. Tú no la conoces nunca.</p>
        ) : (
          <div>
            <label htmlFor="no-pass" className={labelClass}>Contraseña temporal</label>
            <div className="flex gap-2">
              <input id="no-pass" value={password} onChange={e => setPassword(e.target.value)} className={cn(inputClass, 'font-mono')} />
              <button onClick={() => setPassword(genPassword())} type="button" className={buttonClass.secondary} aria-label="Generar otra contraseña">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <button type="submit" disabled={saving} className={cn(buttonClass.primary, 'w-full h-9')}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Crear organización
      </button>
    </form>
  )
}

/** URL local (blob:) de un archivo para previsualizarlo; se libera al cambiar. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    // Sincroniza el estado con un recurso externo (URL del navegador).
    setUrl(u) // eslint-disable-line react-hooks/set-state-in-effect
    return () => { URL.revokeObjectURL(u); setUrl(null) }
  }, [file])
  return file ? url : null
}
