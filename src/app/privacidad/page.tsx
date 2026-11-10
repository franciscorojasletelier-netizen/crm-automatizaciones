import type { Metadata } from 'next'
import Link from 'next/link'

// Página pública (sin sesión): Google la exige como "Política de
// Privacidad" de la app OAuth de Gmail para poder publicarla en
// producción. Debe explicar qué datos de Google se usan y declarar el
// cumplimiento de la política de Uso Limitado.
export const metadata: Metadata = {
  title: 'Política de privacidad · CRM Automatizaciones',
  description: 'Cómo CRM Automatizaciones usa y protege los datos, incluidos los de cuentas de Gmail conectadas.',
}

const UPDATED = '10 de noviembre de 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-8 rounded-lg border border-slate-200 bg-white p-6 shadow-xs md:p-10">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">CRM Automatizaciones</p>
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-slate-900">Política de privacidad</h1>
          <p className="text-sm text-slate-500">Última actualización: {UPDATED}</p>
        </header>

        <Section title="Quiénes somos">
          <p>
            CRM Automatizaciones es una herramienta interna de gestión comercial (leads, cotizaciones, proyectos y
            cobranza) que usan las empresas registradas y sus equipos. Esta política explica qué datos trata el CRM,
            para qué y cómo puedes controlarlos.
          </p>
        </Section>

        <Section title="Datos que tratamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Datos de tu cuenta de usuario: nombre, correo, rol y empresa.</li>
            <li>Datos comerciales que tu equipo registra: contactos, empresas, negocios, cotizaciones, tareas y pagos.</li>
            <li>Si conectas una cuenta de correo (Gmail u Outlook): los datos que se describen en la sección siguiente.</li>
          </ul>
        </Section>

        <Section title="Uso de los datos de Google (Gmail)">
          <p>Cuando un usuario conecta voluntariamente su cuenta de Gmail, el CRM solicita estos permisos:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Ver tu dirección de correo</strong>, para identificar qué cuenta quedó conectada.</li>
            <li>
              <strong>Enviar correos en tu nombre</strong>, solo cuando tú o tu equipo envían desde el CRM una
              cotización, un recordatorio de cobranza o un mensaje a un cliente.
            </li>
            <li>
              <strong>Leer correos</strong>, solo para guardar en el historial del lead o negocio los mensajes que
              intercambias con los contactos registrados en el CRM.
            </li>
          </ul>
          <p>
            No usamos los datos de Gmail para publicidad, no los vendemos, no los compartimos con terceros y no los
            usamos para entrenar modelos de inteligencia artificial. Solo personas autorizadas de tu empresa pueden ver
            los correos asociados a sus negocios.
          </p>
          <p>
            El uso y la transferencia de la información recibida de las APIs de Google cumplen con la{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-accent-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de Datos del Usuario de los Servicios de las APIs de Google
            </a>
            , incluidos los requisitos de Uso Limitado.
          </p>
        </Section>

        <Section title="Dónde se guardan y cómo se protegen">
          <p>
            Los datos se almacenan en servidores de nuestros proveedores de infraestructura (Supabase para la base de
            datos y Vercel para la aplicación), con conexión cifrada. Los permisos de acceso a Gmail se guardan en
            columnas a las que los usuarios no pueden acceder directamente, y cada empresa solo ve sus propios datos.
          </p>
        </Section>

        <Section title="Cómo desconectar tu cuenta y borrar tus datos">
          <p>
            Puedes desconectar tu correo en cualquier momento desde <strong>Configuración → Correo conectado</strong>{' '}
            en el CRM, o quitar el acceso desde{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-accent-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              la configuración de seguridad de tu cuenta de Google
            </a>
            . Al desconectarla, el CRM deja de enviar y leer correos de esa cuenta. Para borrar los datos guardados,
            pide la eliminación al administrador de tu empresa en el CRM.
          </p>
        </Section>

        <Section title="Cambios y contacto">
          <p>
            Si cambiamos esta política, actualizaremos la fecha de arriba. Para consultas sobre privacidad, contacta al
            administrador de la empresa que te dio acceso al CRM.
          </p>
        </Section>

        <footer className="border-t border-slate-100 pt-4 text-sm">
          <Link href="/login" className="text-accent-700 hover:underline">Ir al CRM</Link>
        </footer>
      </article>
    </main>
  )
}
