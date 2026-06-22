export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_META, getRoleMeta, type Role } from '@/lib/roles'
import { Users, CheckCircle2, XCircle } from 'lucide-react'
import UserRoleEditor from '@/components/admin/user-role-editor'
import AddUserButton from '@/components/admin/add-user-button'
import AreasManager from '@/components/admin/areas-manager'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  // Normalizar rol (admin legacy → super_admin)
  const { normalizeRole } = await import('@/lib/roles')
  const normalizedRole = normalizeRole(currentProfile?.role ?? '')
  if (!['super_admin', 'gerente'].includes(normalizedRole)) {
    redirect('/acceso-denegado?from=/admin/usuarios&role=' + normalizedRole)
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('role').order('full_name')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, color')
    .order('name')

  const currentRole = currentProfile?.role as Role

  function getInitials(name: string | null, email: string | null) {
    if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    if (email) return email.slice(0, 2).toUpperCase()
    return 'U'
  }

  // Stats por rol
  const byRole = Object.keys(ROLE_META).reduce((acc, r) => {
    acc[r] = users?.filter(u => u.role === r).length ?? 0
    return acc
  }, {} as Record<string, number>)

  const totalActive = users?.filter(u => u.is_active).length ?? 0

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{users?.length ?? 0}</span> usuarios ·{' '}
            <span className="font-semibold text-emerald-600">{totalActive}</span> activos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AreasManager areas={areas ?? []} />
          <AddUserButton
            editorRole={normalizedRole}
            people={(users ?? []).map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }))}
            areas={areas ?? []}
          />
        </div>
      </div>

      {/* Resumen de roles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([role, meta]) => (
          <div key={role} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.badge}`} />
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{byRole[role] ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-400 truncate">{meta.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Usuarios del sistema</h2>
        </div>

        <div className="divide-y divide-slate-50">
          {(!users || users.length === 0) && (
            <div className="py-14 text-center">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">No hay usuarios registrados</p>
            </div>
          )}

          {users?.map((u: any) => {
            const roleMeta = getRoleMeta(u.role)
            const initials = getInitials(u.full_name, u.email)
            const isSelf = u.id === user.id
            // gerente solo puede editar comercial, produccion, soporte (no super_admin ni otro gerente)
            const canEdit = currentRole === 'super_admin'
              ? !isSelf  // super_admin puede editar a todos menos a sí mismo
              : currentRole === 'gerente'
                ? !isSelf && !['super_admin', 'gerente'].includes(u.role)
                : false

            return (
              <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{u.full_name ?? '—'}</p>
                    {isSelf && (
                      <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">Tú</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>

                {/* Estado */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {u.is_active
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  }
                  <span className={`text-xs font-medium ${u.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Rol + editor */}
                <div className="shrink-0">
                  {canEdit ? (
                    <UserRoleEditor
                      userId={u.id}
                      currentRole={u.role}
                      isActive={u.is_active}
                      editorRole={currentRole}
                    />
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${roleMeta.color}`}>
                      {roleMeta.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
