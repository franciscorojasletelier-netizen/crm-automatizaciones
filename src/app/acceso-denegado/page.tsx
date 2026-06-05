import Link from 'next/link'
import { ShieldX, Zap } from 'lucide-react'
import { getRoleMeta, normalizeRole } from '@/lib/roles'

export default async function AccesoDenegadoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; role?: string }>
}) {
  const { from, role: rawRole } = await searchParams
  const role = normalizeRole(rawRole ?? 'soporte')
  const roleMeta = getRoleMeta(role)

  const sectionNames: Record<string, string> = {
    '/pipeline':      'Pipeline de ventas',
    '/leads':         'Leads',
    '/empresas':      'Empresas',
    '/tareas':        'Tareas',
    '/proyectos':     'Proyectos',
    '/admin/usuarios':'Gestión de usuarios',
    '/admin':         'Panel de administración',
    '/configuracion': 'Configuración del sistema',
  }

  const sectionName = Object.entries(sectionNames).find(([key]) =>
    from?.startsWith(key)
  )?.[1] ?? 'esta sección'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Ícono */}
        <div className="relative inline-flex">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
            <ShieldX className="w-10 h-10 text-red-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
            <span className="text-white text-xs font-black">!</span>
          </div>
        </div>

        {/* Mensaje */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Acceso restringido</h1>
          <p className="text-slate-500 mt-2 leading-relaxed">
            Tu rol de{' '}
            <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ring-1 inline-block mx-1 ${roleMeta.color} ring-current`}>
              {roleMeta.label}
            </span>{' '}
            no tiene permisos para acceder a{' '}
            <strong className="text-slate-700">{sectionName}</strong>.
          </p>
        </div>

        {/* Info del rol */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-left">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tu acceso actual</p>
          <p className="text-sm text-slate-600 leading-relaxed">{roleMeta.description}</p>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          <Link href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap className="w-4 h-4" />
            Ir a mi Dashboard
          </Link>
          <Link href="/leads"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
            Volver a Leads
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          ¿Necesitas acceso? Contacta a tu administrador o gerente.
        </p>
      </div>
    </div>
  )
}
