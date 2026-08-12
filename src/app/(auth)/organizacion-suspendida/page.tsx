import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function OrganizacionSuspendidaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Cuenta suspendida</h1>
        <p className="text-sm text-slate-500">
          El acceso de tu organización está suspendido temporalmente. Contactá al administrador para más información.
        </p>
        <Link href="/login" className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Volver al login
        </Link>
      </div>
    </div>
  )
}
