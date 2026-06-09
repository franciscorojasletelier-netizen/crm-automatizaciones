'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, ChevronDown, Check, Loader2 } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string
}

interface Props {
  dealId:       string
  currentOwner: { id: string; full_name: string | null } | null
  teamUsers:    Profile[]
  canReassign:  boolean
  onReassigned?: (dealId: string, newOwner: Profile) => void
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Super Admin', gerente: 'Gerente',
  comercial: 'Ejecutivo', produccion: 'Producción', soporte: 'Soporte',
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

function getAvatarColor(id: string) {
  const colors = [
    'from-violet-500 to-indigo-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-pink-500 to-rose-500',
  ]
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function DealOwnerSelector({ dealId, currentOwner, teamUsers, canReassign, onReassigned }: Props) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [owner, setOwner]   = useState(currentOwner)
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function assign(user: Profile) {
    if (user.id === owner?.id) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    const supabase = createClient()
    const { error } = await supabase.from('deals').update({ owner_id: user.id }).eq('id', dealId)
    if (!error) {
      // Notificar al nuevo responsable
      const { data: { user: me } } = await supabase.auth.getUser()
      if (me && user.id !== me.id) {
        await supabase.from('notifications').insert({
          user_id:     user.id,
          type:        'deal_assigned',
          title:       `📋 Te asignaron un deal`,
          body:        `Ahora eres el responsable de este lead`,
          entity_type: 'deal',
          entity_id:   dealId,
        })
      }
      setOwner({ id: user.id, full_name: user.full_name })
      // Callback para eliminación optimista en la tabla
      onReassigned?.(dealId, user)
      router.refresh()
    }
    setSaving(false)
  }

  const initials    = getInitials(owner?.full_name ?? null, null)
  const avatarColor = owner ? getAvatarColor(owner.id) : 'from-slate-400 to-slate-500'

  if (!canReassign) {
    // Solo mostrar, sin dropdown
    return (
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 shadow-sm`}>
          <span className="text-[11px] font-bold text-white">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Responsable</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{owner?.full_name ?? '—'}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !saving && setOpen(o => !o)}
        className={`flex items-center gap-2.5 w-full text-left rounded-xl transition-all group ${
          open ? 'ring-2 ring-indigo-300 bg-indigo-50' : 'hover:bg-slate-50'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 shadow-sm`}>
          {saving
            ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            : <span className="text-[11px] font-bold text-white">{initials}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Responsable</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{owner?.full_name ?? 'Sin asignar'}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''} group-hover:text-indigo-500`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500">Reasignar lead a</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {teamUsers.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No hay usuarios disponibles</p>
            )}
            {teamUsers.map(u => (
              <button
                key={u.id}
                onClick={() => assign(u)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left ${
                  u.id === owner?.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(u.id)} flex items-center justify-center shrink-0`}>
                  <span className="text-[11px] font-bold text-white">{getInitials(u.full_name, u.email)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name ?? u.email}</p>
                  <p className="text-[10px] text-slate-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                </div>
                {u.id === owner?.id && (
                  <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
