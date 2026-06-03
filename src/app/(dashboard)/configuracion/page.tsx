import { createClient } from '@/lib/supabase/server'
import { User, Bell, Shield, Database } from 'lucide-react'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes de tu cuenta y del sistema</p>
      </div>

      {/* Perfil */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">Mi perfil</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nombre</p>
              <p className="text-sm font-medium text-gray-900">{profile?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-sm text-gray-700">{profile?.email ?? user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Rol</p>
              <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full capitalize">
                {profile?.role ?? '—'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estado</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {profile?.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seguridad */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">Seguridad</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600">Para cambiar tu contraseña, usa el panel de Supabase Authentication o solicítalo al administrador.</p>
        </div>
      </div>

      {/* Sistema */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">Sistema</h2>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <p className="text-sm text-gray-600">Base de datos</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Conectada</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <p className="text-sm text-gray-600">Autenticación</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activa</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-600">Versión</p>
            <span className="text-xs text-gray-400">MVP v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
