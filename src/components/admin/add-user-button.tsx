'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { UserPlus, X, Loader2, Check, RefreshCw, Copy } from 'lucide-react'
import { ROLE_META, type Role } from '@/lib/roles'

interface Person {
  id: string
  full_name: string | null
  email: string | null
}

interface Props {
  editorRole: Role
  people: Person[]
}

const ASSIGNABLE: Record<string, Role[]> = {
  super_admin: ['gerente', 'comercial', 'produccion', 'soporte'],
  gerente:     ['comercial', 'produccion', 'soporte'],
}

function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let p = ''
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

export default function AddUserButton({ editorRole, people }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const assignable = ASSIGNABLE[editorRole] ?? []
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(genPassword())
  const [role, setRole] = useState<Role>(assignable[assignable.length - 1] ?? 'soporte')
  const [managerId, setManagerId] = useState('')

  function reset() {
    setFullName(''); setEmail(''); setPassword(genPassword())
    setRole(assignable[assignable.length - 1] ?? 'soporte')
    setManagerId(''); setError(''); setDone(false)
  }

  function close() { setOpen(false); reset() }

  async function submit() {
    if (saving) return
    setError('')
    if (!fullName.trim()) { setError('El nombre es requerido'); return }
    if (!email.trim()) { setError('El email es requerido'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setSaving(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, role, managerId }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error ?? 'Error al crear el usuario'); return }
    setDone(true)
    router.refresh()
  }

  if (assignable.length === 0) return null

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <UserPlus className="w-4 h-4" />
        Agregar usuario
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={close}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-indigo-300" />
              </div>
              <h2 className="flex-1 text-sm font-bold text-white">Nuevo usuario</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {done ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Usuario creado</p>
                <p className="text-xs text-slate-500">
                  Comparte estas credenciales con <span className="font-semibold">{fullName}</span>:
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5">
                  <p className="text-xs text-slate-600"><span className="font-semibold">Email:</span> {email}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-600"><span className="font-semibold">Contraseña:</span> {password}</p>
                    <button onClick={() => navigator.clipboard?.writeText(`Email: ${email}\nContraseña: ${password}`)}
                      className="text-indigo-500 hover:text-indigo-700" title="Copiar">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { reset(); }}
                    className="flex-1 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2 transition-colors">
                    Crear otro
                  </button>
                  <button onClick={close}
                    className="flex-1 text-sm font-semibold text-white rounded-xl py-2 transition-colors"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                {/* Nombre */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Nombre completo</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Ej: María González"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                    placeholder="maria@empresa.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                </div>

                {/* Contraseña temporal */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Contraseña temporal</label>
                  <div className="flex gap-2">
                    <input value={password} onChange={e => setPassword(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 font-mono" />
                    <button onClick={() => setPassword(genPassword())} type="button"
                      className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Generar otra">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">El usuario podrá cambiarla luego.</p>
                </div>

                {/* Rol */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Rol / Puesto</label>
                  <select value={role} onChange={e => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 bg-white">
                    {assignable.map(r => (
                      <option key={r} value={r}>{ROLE_META[r].label}</option>
                    ))}
                  </select>
                </div>

                {/* Jefe directo */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Jefe directo (opcional)</label>
                  <select value={managerId} onChange={e => setManagerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 bg-white">
                    <option value="">— Sin jefe —</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={close}
                    className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl py-2 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={submit} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2 disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Crear usuario
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
