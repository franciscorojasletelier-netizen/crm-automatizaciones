import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'

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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">{companies?.length ?? 0} registradas</p>
        </div>
        <Link href="/leads/nuevo"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />
          Nueva empresa
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
                  No hay empresas aún.{' '}
                  <Link href="/leads/nuevo" className="text-gray-900 underline">Crear un lead</Link>
                </td>
              </tr>
            )}
            {companies?.map((company: any) => {
              const activeDeals = company.deals?.filter((d: any) => d.status === 'open').length ?? 0
              return (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-300 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{company.name}</p>
                        {company.website && (
                          <p className="text-xs text-gray-400">{company.website}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{company.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{company.contacts?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${activeDeals > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {activeDeals}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${company.is_existing_client ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {company.is_existing_client ? 'Cliente' : 'Prospecto'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
