'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, UserPlus, X, Crown, Loader2, Check } from 'lucide-react'
import { getInitials } from '@/lib/format'
import { getRoleMeta } from '@/lib/roles'

interface Member {
  id: string
  user_id: string
  profiles: { full_name: string | null; email: string | null; role: string }
}

interface TeamUser {
  id: string
  full_name: string | null
  email: string | null
  role: string
}

interface Props {
  dealId: string
  ownerId: string | null
  members: Member[]
  teamUsers: TeamUser[]  // todos los comerciales del equipo
  currentUserId: string
  canManage: boolean     // solo gerente/super_admin
}



export default function DealMembers({ dealId, ownerId, members, teamUsers, currentUserId, canManage }: Props) {
  const [list, setList] = useState<Member[]>(members)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [changingOwner, setChangingOwner] = useState(false)
  const [localOwnerId, setLocalOwnerId] = useState(ownerId)
  const router = useRouter()
  const supabase = createClient()

  const memberUserIds = new Set(list.map(m => m.user_id))
  const availableToAdd = teamUsers.filter(u =>
    u.id !== localOwnerId &&
    !memberUserIds.has(u.id) &&
    ['comercial', 'produccion', 'soporte'].includes(u.role)
  )

  async function addMember(user: TeamUser) {
    setAdding(user.id)
    const { data } = await supabase
      .from('deal_members')
      .insert({ deal_id: dealId, user_id: user.id, added_by: currentUserId })
      .select('id, user_id')
      .single()

    if (data) {
      setList(prev => [...prev, {
        id: data.id,
        user_id: data.user_id,
        profiles: { full_name: user.full_name, email: user.email, role: user.role },
      }])
    }
    setAdding(null)
    setShowAdd(false)
    router.refresh()
  }

  async function removeMember(memberId: string) {
    setRemoving(memberId)
    await supabase.from('deal_members').delete().eq('id', memberId)
    setList(prev => prev.filter(m => m.id !== memberId))
    setRemoving(null)
    router.refresh()
  }

  async function changeOwner(newOwnerId: string) {
    setChangingOwner(true)
    await supabase.from('deals').update({ owner_id: newOwnerId }).eq('id', dealId)
    // Agregar el nuevo owner como member también (si no lo era)
    await supabase.from('deal_members')
      .upsert({ deal_id: dealId, user_id: newOwnerId, added_by: currentUserId }, { onConflict: 'deal_id,user_id' })
    setLocalOwnerId(newOwnerId)
    setChangingOwner(false)
    setShowAdd(false)
    router.refresh()
  }

  if (!canManage) {
    // Solo lectura: muestra los miembros pero sin controles
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Equipo en este lead</h2>
        </div>
        <div className="space-y-2">
          {localOwnerId && (() => {
            const owner = teamUsers.find(u => u.id === localOwnerId)
            return owner ? (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent-100 flex items-center justify-center text-[11px] font-bold text-accent-700 shrink-0">
                  {getInitials(owner.full_name, owner.email, 'U')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{owner.full_name ?? owner.email}</p>
                  <p className="text-[11px] text-slate-400">{getRoleMeta(owner.role).label}</p>
                </div>
                <Crown className="w-3 h-3 text-amber-500 ml-auto shrink-0" />
              </div>
            ) : null
          })()}
          {list.map(m => (
            <div key={m.id} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                {getInitials(m.profiles.full_name, m.profiles.email, 'U')}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{m.profiles.full_name ?? m.profiles.email}</p>
                <p className="text-[11px] text-slate-400">{getRoleMeta(m.profiles.role).label}</p>
              </div>
            </div>
          ))}
          {!localOwnerId && list.length === 0 && (
            <p className="text-xs text-slate-400 italic">Sin equipo asignado</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Equipo asignado</h2>
          <span className="text-xs font-bold bg-accent-100 text-accent-600 px-2 py-0.5 rounded-full">
            {1 + list.length} persona{1 + list.length !== 1 ? 's' : ''}
          </span>
        </div>
        {availableToAdd.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              showAdd ? 'bg-slate-100 text-slate-600' : 'bg-accent-50 text-accent-600 hover:bg-accent-100'
            }`}>
            <UserPlus className="w-3.5 h-3.5" />
            Agregar
          </button>
        )}
      </div>

      {/* Lista para agregar */}
      {showAdd && (
        <div className="border-b border-slate-100 bg-slate-50 p-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 px-1 mb-2">
            Selecciona un miembro del equipo
          </p>
          {availableToAdd.map(user => (
            <button key={user.id} onClick={() => addMember(user)} disabled={adding === user.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white hover:bg-accent-50 border border-slate-200 hover:border-accent-200 transition-all text-left group">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 group-hover:bg-accent-100 group-hover:text-accent-700 transition-colors">
                {getInitials(user.full_name, user.email, 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.full_name ?? user.email}</p>
                <p className="text-xs text-slate-400">{getRoleMeta(user.role).label}</p>
              </div>
              {adding === user.id
                ? <Loader2 className="w-4 h-4 animate-spin text-accent-500 shrink-0" />
                : <Check className="w-4 h-4 text-slate-400 group-hover:text-accent-500 transition-colors shrink-0" />
              }
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-slate-50 p-3 space-y-1">
        {/* Owner — responsable principal */}
        {localOwnerId && (() => {
          const owner = teamUsers.find(u => u.id === localOwnerId)
          return owner ? (
            <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
              <div className="bg-accent-600 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                 >
                {getInitials(owner.full_name, owner.email, 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{owner.full_name ?? owner.email}</p>
                <p className="text-xs text-slate-400">{getRoleMeta(owner.role).label}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  Responsable
                </span>
              </div>
            </div>
          ) : null
        })()}

        {/* Miembros adicionales */}
        {list.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 group-hover:bg-accent-50 group-hover:text-accent-700 transition-colors">
              {getInitials(m.profiles.full_name, m.profiles.email, 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{m.profiles.full_name ?? m.profiles.email}</p>
              <p className="text-xs text-slate-400">{getRoleMeta(m.profiles.role).label}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Hacer responsable principal */}
              {m.user_id !== localOwnerId && m.profiles.role === 'comercial' && (
                <button onClick={() => changeOwner(m.user_id)} disabled={changingOwner}
                  title="Hacer responsable principal"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full">
                  {changingOwner ? '...' : '→ Principal'}
                </button>
              )}
              <button onClick={() => removeMember(m.id)} disabled={removing === m.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                {removing === m.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <X className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>
        ))}

        {!localOwnerId && list.length === 0 && (
          <div className="py-6 text-center">
            <Users className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
            <p className="text-xs text-slate-400 font-medium">Sin equipo asignado aún</p>
          </div>
        )}
      </div>
    </div>
  )
}
