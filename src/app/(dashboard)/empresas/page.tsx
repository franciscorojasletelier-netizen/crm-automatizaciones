export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, Globe, Users, TrendingUp } from 'lucide-react'
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

  const { data: deals } = await supabase
    .from('deals')
    .select('id, company_id')
    .eq('status', 'open')

  const dealByCompany: Record<string, string> = {}
  deals?.forEach(d => { dealByCompany[d.company_id] = d.id })

  const totalClients = companies?.filter(c => c.is_existing_client).length ?? 0
  const totalProspects = (companies?.length ?? 0) - totalClients
  const totalWithDeals = companies?.filter(c =>
    (c.deals as any[])?.some((d: any) => d.status === 'open')
  ).length ?? 0

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{companies?.length ?? 0}</span> registradas
          </p>
        </div>
        <Link href="/leads/nuevo"
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva empresa</span>
          <span className="sm:hidden">Nueva</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalClients}</p>
            <p className="text-xs text-slate-500 font-medium">Clientes</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalProspects}</p>
            <p className="text-xs text-slate-500 font-medium">Prospectos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalWithDeals}</p>
            <p className="text-xs text-slate-500 font-medium">Con deals</p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Industria</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Contactos</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Deals activos</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(!companies || companies.length === 0) && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No hay empresas aún.</p>
                  <Link href="/leads/nuevo" className="text-indigo-600 text-sm font-medium hover:text-indigo-800 mt-1 inline-block">
                    Crear un lead →
                  </Link>
                </td>
              </tr>
            )}
            {companies?.map((company: any) => (
              <CompanyRow key={company.id} company={company} dealId={dealByCompany[company.id]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
