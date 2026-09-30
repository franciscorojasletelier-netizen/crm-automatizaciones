import Link from 'next/link'
import AuthShell from '@/components/auth/auth-shell'

export default function OrganizacionSuspendidaPage() {
  return (
    <AuthShell title="Acceso suspendido"
      description="El acceso de tu organización está suspendido temporalmente."
      footer={<Link href="/login" className="text-accent-700 hover:underline">Volver a iniciar sesión</Link>}>
      <p className="text-sm text-slate-600">Contacta al administrador de tu organización para reactivarlo.</p>
    </AuthShell>
  )
}
