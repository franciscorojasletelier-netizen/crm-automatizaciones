// Marco común de las pantallas de acceso (login, recuperar contraseña,
// 2FA, organización suspendida): tarjeta centrada y sobria, sin la
// ilustración de marketing. Es una herramienta de trabajo, no una landing.

export default function AuthShell({ title, description, children, footer }: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-semibold" aria-hidden>CRM</div>
          <span className="text-sm font-semibold text-slate-900">CRM Automatizaciones</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-6 py-7">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-slate-500">{footer}</div>}
      </div>
    </main>
  )
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{children}</p>
  )
}
