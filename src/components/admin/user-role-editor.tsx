'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROLE_META, getRoleMeta, type Role } from '@/lib/roles'
import { Check, ChevronDown, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Props {
  userId: string
  currentRole: string
  isActive: boolean
  editorRole: Role
}

// Roles que un gerente puede asignar (no puede dar super_admin ni gerente)
const ASSIGNABLE_BY_GERENTE: Role[] = ['comercial', 'produccion', 'soporte']
const ASSIGNABLE_BY_SUPER_ADMIN: Role[] = ['gerente', 'comercial', 'produccion', 'soporte']

export default function UserRoleEditor({ userId, currentRole, isActive, editorRole }: Props) {
  const [role, setRole] = useState(currentRole)
  const [active, setActive] = useState(isActive)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0, dropUp: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  function handleOpen() {
    if (saving) return
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropUp = spaceBelow < 320  // ~altura del menú con 4-5 roles
      setPos({
        top:   dropUp ? rect.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        dropUp,
      })
    }
    setOpen(o => !o)
  }
  const supabase = createClient()
  const roleMeta = getRoleMeta(role)

  const assignableRoles = editorRole === 'super_admin'
    ? ASSIGNABLE_BY_SUPER_ADMIN
    : ASSIGNABLE_BY_GERENTE

  async function handleRoleChange(newRole: Role) {
    if (newRole === role) { setOpen(false); return }
    setSaving(true)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setRole(newRole)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  async function handleToggleActive() {
    setSaving(true)
    await supabase.from('profiles').update({ is_active: !active }).eq('id', userId)
    setActive(!active)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Toggle activo/inactivo */}
      <button onClick={handleToggleActive} disabled={saving}
        className={`transition-colors ${active ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-500'}`}
        title={active ? 'Desactivar cuenta' : 'Activar cuenta'}>
        {active
          ? <ToggleRight className="w-5 h-5" />
          : <ToggleLeft className="w-5 h-5" />
        }
      </button>

      {/* Selector de rol */}
      <div className="relative">
        <button ref={btnRef} onClick={handleOpen} disabled={saving}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl ring-1 transition-all hover:shadow-sm ${roleMeta.color}`}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {roleMeta.label}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && mounted && createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              style={{
                position: 'fixed',
                top:    pos.dropUp ? 'auto' : pos.top,
                bottom: pos.dropUp ? window.innerHeight - pos.top + 6 : 'auto',
                right:  pos.right,
                zIndex: 99,
              }}
              className="w-52 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-1.5 space-y-0.5">
                {assignableRoles.map(r => {
                  const meta = ROLE_META[r]
                  const isSelected = r === role
                  return (
                    <button key={r} onClick={() => handleRoleChange(r)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors group ${
                        isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}>
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${meta.badge}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {meta.description}
                        </p>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  )
}
