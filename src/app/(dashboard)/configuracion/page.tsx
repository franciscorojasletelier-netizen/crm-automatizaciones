export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getRoleMeta } from '@/lib/roles'
import ChangePasswordCard from './ChangePasswordCard'
import TwoFactorCard from './TwoFactorCard'

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function ConfiguracionPage({ searchParams }: { searchParams: Promise<{ mfaRequired?: string }> }) {
  const { mfaRequired } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()

  const displayName = profile?.full_name ?? user?.email ?? '—'
  const initials = getInitials(displayName)
  const role = getRoleMeta(profile?.role ?? '')

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ajustes de tu cuenta</p>
        </div>

        {/* Perfil hero */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-12 relative" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
            <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 50%, #6366f1, transparent)' }} />
          </div>
          <div className="px-6 pb-6 pt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">{displayName}</h2>
                <p className="text-sm text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rol</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${role.color}`}>
                  {role.label}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${profile?.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-xs font-semibold text-slate-700">
                    {profile?.is_active ? 'Cuenta activa' : 'Cuenta inactiva'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seguridad — flujo real de cambio de contraseña, no un mensaje muerto */}
        <ChangePasswordCard email={user?.email ?? ''} />

        <TwoFactorCard mfaRequired={mfaRequired === '1'} />

      </div>
    </div>
  )
}
