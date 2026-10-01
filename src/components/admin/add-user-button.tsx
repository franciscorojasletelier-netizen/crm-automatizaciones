'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { UserPlus, X, Loader2, Check, RefreshCw, Copy, Shield } from 'lucide-react'
import { type Role, type SectionMode } from '@/lib/roles'
import SectionChecklist from '@/components/admin/section-checklist'
import { useDialog } from '@/lib/use-dialog'

interface Person {
  id: string
  full_name: string | null
  email: string | null
}

export interface Area {
  id: string
  name: string
  color: string
}

interface Props {
  editorRole: Role
  people: Person[]
  areas: Area[]
}

function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let p = ''
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

export default function AddUserButton({ editorRole, people, areas }: Props) {
  const router = useRouter()
  const canMakeAdmin = editorRole === 'super_admin'
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(genPassword())
  const [managerId, setManagerId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [areaId, setAreaId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const DEFAULT_SECTIONS: Record<string, SectionMode> = { dashboard: 'full', organigrama: 'full' }
  const [sections, setSections] = useState<Record<string, SectionMode>>(DEFAULT_SECTIONS)

  function reset() {
    setFullName(''); setEmail(''); setPassword(genPassword())
    setManagerId(''); setJobTitle(''); setAreaId('')
    setIsAdmin(false); setSections(DEFAULT_SECTIONS)
    setError(''); setDone(false)
  }
  function close() { setOpen(false); reset() }
  const dialogRef = useDialog(open, close, saving)

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
      body: JSON.stringify({ fullName, email, password, managerId, jobTitle, areaId, isAdmin, sectionAccess: sections }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al crear el usuario'); return }
    setDone(true)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-accent-600 flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-xs transition-all"
         >
        <UserPlus className="w-4 h-4" />
        Agregar usuario
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={close}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Agregar usuario" className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col outline-none" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 px-5 py-4 flex items-center gap-2.5 shrink-0" >
              <div className="w-8 h-8 rounded-lg bg-accent-500/30 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-accent-300" />
              </div>
              <h2 className="flex-1 text-sm font-bold text-white">Nuevo usuario</h2>
              <button aria-label="Cerrar" onClick={close} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {done ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Usuario creado</p>
                <p className="text-xs text-slate-500">Comparte estas credenciales con <span className="font-semibold">{fullName}</span>:</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left space-y-1.5">
                  <p className="text-xs text-slate-600"><span className="font-semibold">Email:</span> {email}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-600"><span className="font-semibold">Contraseña:</span> {password}</p>
                    <button onClick={() => navigator.clipboard?.writeText(`Email: ${email}\nContraseña: ${password}`)}
                      className="text-accent-500 hover:text-accent-700" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={reset} className="flex-1 text-sm font-semibold text-accent-600 bg-accent-50 hover:bg-accent-100 rounded-lg py-2 transition-colors">Crear otro</button>
                  <button onClick={close} className="bg-accent-600 flex-1 text-sm font-semibold text-white rounded-lg py-2 transition-colors" >Listo</button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3.5 overflow-y-auto">
                <div>
                  <label htmlFor="add-user-button-f1" className="text-xs font-semibold text-slate-600 mb-1 block">Nombre completo</label>
                  <input id="add-user-button-f1" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej: María González"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100" />
                </div>
                <div>
                  <label htmlFor="add-user-button-f2" className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
                  <input id="add-user-button-f2" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="maria@empresa.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Contraseña temporal</label>
                  <div className="flex gap-2">
                    <input aria-label="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100 font-mono" />
                    <button onClick={() => setPassword(genPassword())} type="button" className="px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Generar otra">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="add-user-button-f3" className="text-xs font-semibold text-slate-600 mb-1 block">Cargo / Puesto</label>
                  <input id="add-user-button-f3" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Ej: Jefe de Marketing, Contador…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100" />
                </div>
                <div>
                  <label htmlFor="add-user-button-f4" className="text-xs font-semibold text-slate-600 mb-1 block">Área / Departamento</label>
                  <select id="add-user-button-f4" value={areaId} onChange={e => setAreaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 bg-white">
                    <option value="">— Sin área —</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="add-user-button-f5" className="text-xs font-semibold text-slate-600 mb-1 block">Jefe directo (opcional)</label>
                  <select id="add-user-button-f5" value={managerId} onChange={e => setManagerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 bg-white">
                    <option value="">— Sin jefe —</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
                  </select>
                </div>

                {/* Interruptor Administrador */}
                {canMakeAdmin && (
                  <button type="button" onClick={() => setIsAdmin(v => !v)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${isAdmin ? 'border-accent-300 bg-accent-50' : 'border-slate-200 bg-white'}`}>
                    <Shield className={`w-4 h-4 ${isAdmin ? 'text-accent-600' : 'text-slate-400'}`} />
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-slate-700">Administrador</p>
                      <p className="text-[11px] text-slate-400">Gestiona usuarios, áreas y datos sensibles</p>
                    </div>
                    <span className={`w-9 h-5 rounded-full transition-colors relative ${isAdmin ? 'bg-accent-500' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isAdmin ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                  </button>
                )}

                {/* Checklist de secciones */}
                <SectionChecklist
                  value={sections}
                  isAdmin={isAdmin}
                  onChange={(key, mode) => setSections(prev => {
                    const next = { ...prev }
                    if (mode === null) delete next[key]
                    else next[key] = mode
                    return next
                  })}
                />

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-xs text-red-700">{error}</p></div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={close} className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors">Cancelar</button>
                  <button onClick={submit} disabled={saving}
                    className="bg-accent-600 flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-lg py-2 disabled:opacity-50 transition-all"
                     >
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
