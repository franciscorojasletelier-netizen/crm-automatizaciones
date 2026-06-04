export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import CompanyRow from '@/components/empresas/company-row'

export default async function EmpresasPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select(`
      id, name, industry, website, country, employee_count, is_existing_client, created_at,
      contacts(id),
      deals(id, status)
    `)
    .order('name')

  // Obtener el deal id asociado a cada empresa
  const { data: deals } = await supabase
    .from('deals')
    .select('id, company_id')
    .eq('status', 'open')

  const dealByCompany: Record<string, string> = {}
  deals?.forEach(d => { dealByCompany[d.company_id] = d.id })

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">{companies?.length ?? 0} registradas</p>
        </div>
        <Link href="/leads/nuevo"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva empresa</span>
          <span className="sm:hidden">Nueva</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Industria</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contactos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deals activos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(!companies || companies.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No hay empresas aÃºn.{' '}
                  <Link href="/leads/nuevo" className="text-gray-900 underline">Crear un lead</Link>
                </td>
              </tr>
            )}
            {companies?.map((company: any) => (
              <CompanyRow
                key={company.id}
                company={company}
                dealId={dealByCompany[company.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

