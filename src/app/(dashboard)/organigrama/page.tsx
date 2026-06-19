export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizeRole } from '@/lib/roles'
import { Network, Info } from 'lucide-react'
import OrgChart, { type OrgPerson } from '@/components/organigrama/org-chart'

export default async function OrganigramaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const role = normalizeRole(currentProfile?.role ?? '')
  const isAdmin = role === 'super_admin'

  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, manager_id')
    .order('full_name')

  const activePeople = (people ?? []).filter((p: any) => p.is_active) as OrgPerson[]

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-600" />
            Organigrama
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{activePeople.length}</span> personas ·
            estructura del equipo y chat directo
          </p>
        </div>
      </div>

      {/* Aviso según rol */}
      <div className="flex items-start gap-2.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-900/80 leading-relaxed">
          {isAdmin
            ? 'Como administrador puedes asignar el jefe directo de cada persona con el selector de cada tarjeta. Haz clic en "Chatear" para abrir una conversación directa.'
            : 'Haz clic en "Chatear" en cualquier persona para abrir una conversación directa. La estructura del equipo solo la edita el administrador.'}
        </p>
      </div>

      {/* Organigrama */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
        {activePeople.length === 0 ? (
          <div className="py-14 text-center">
            <Network className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No hay personas activas</p>
          </div>
        ) : (
          <OrgChart people={activePeople} currentUserId={user.id} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  )
}
