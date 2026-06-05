export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { User, Shield, Database, CheckCircle2, Zap, Mail } from 'lucide-react'

const roleConfig: Record<string, { label: string; color: string }> = {
  admin:       { label: 'Administrador', color: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  comercial:   { label: 'Comercial',     color: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  operaciones: { label: 'Operaciones',   color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  finanzas:    { label: 'Finanzas',      color: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()

  const displayName = profile?.full_name ?? user?.email ?? '—'
  const initials = getInitials(displayName)
  const role = roleConfig[profile?.role] ?? { label: profile?.role ?? '—', color: 'bg-slate-100 text-slate-600' }

  return (
    <div className="p-4 md:p-6 min-h-full bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ajustes de tu cuenta y del sistema</p>
        </div>

        {/* Perfil hero */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-20 relative" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
            <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 50%, #6366f1, transparent)' }} />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-8 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg border-4 border-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {initials}
              </div>
              <div className="mb-1">
                <h2 className="text-lg font-bold text-slate-900">{displayName}</h2>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rol</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${role.color}`}>
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

        {/* Seguridad */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Seguridad</h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Cambio de contraseña</p>
                <p className="text-xs text-amber-700 mt-0.5">Para cambiar tu contraseña, contáctate con el administrador del sistema o usa el panel de Supabase Authentication.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sistema */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Sistema</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { label: 'Base de datos Supabase', status: 'Conectada', ok: true },
              { label: 'Autenticación',           status: 'Activa',    ok: true },
              { label: 'Webhooks Meta Lead Ads',  status: 'Activos',   ok: true },
            ].map(({ label, status, ok }) => (
              <div key={label} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${ok ? 'text-emerald-500' : 'text-red-400'}`} />
                  <span className={`text-xs font-semibold ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{status}</span>
                </div>
              </div>
            ))}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Versión</p>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-600">MVP v1.0</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
