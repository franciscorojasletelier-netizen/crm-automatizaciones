'use client'

import { useState } from 'react'
import { Building2, Loader2, Check, RefreshCw, Copy, UserPlus } from 'lucide-react'

function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let p = ''
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

export default function NewOrganizationForm() {
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(genPassword())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function reset() {
    setOrgName(''); setFullName(''); setEmail(''); setPassword(genPassword())
    setError(''); setDone(false)
  }

  async function submit() {
    if (saving) return
    setError('')
    if (!orgName.trim())  { setError('El nombre de la organización es requerido'); return }
    if (!fullName.trim()) { setError('El nombre del admin es requerido'); return }
    if (!email.trim())    { setError('El email es requerido'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setSaving(true)
    const res = await fetch('/api/platform/create-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, fullName, email, password }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al crear la organización'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
          <Check className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-slate-900">Organización creada</p>
        <p className="text-xs text-slate-500">Comparte estas credenciales con el admin de <span className="font-semibold">{orgName}</span>:</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5">
          <p className="text-xs text-slate-600"><span className="font-semibold">Email:</span> {email}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600"><span className="font-semibold">Contraseña:</span> {password}</p>
            <button onClick={() => navigator.clipboard?.writeText(`Email: ${email}\nContraseña: ${password}`)}
              className="text-indigo-500 hover:text-indigo-700" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <button onClick={reset} className="text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2 px-4 transition-colors">
          Crear otra organización
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5">
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Nombre de la organización
        </label>
        <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ej: Kovacs SpA"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div className="pt-1 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 mt-2">Primer usuario admin</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Nombre completo</label>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej: María González"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="maria@empresa.com"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Contraseña temporal</label>
        <div className="flex gap-2">
          <input value={password} onChange={e => setPassword(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 font-mono" />
          <button onClick={() => setPassword(genPassword())} type="button" className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Generar otra">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2"><p className="text-xs text-red-700">{error}</p></div>
      )}

      <button onClick={submit} disabled={saving}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2.5 disabled:opacity-50 transition-all"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Crear organización
      </button>
    </div>
  )
}
