export const dynamic = 'force-dynamic'
import { requirePermission } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import CompanyRow, { type CompanyListItem } from '@/components/empresas/company-row'
import { getFieldDefinitions } from '@/lib/fields'
import { PageContainer, PageHeader, StatStrip, Stat, EmptyState, buttonClass, inputClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; tipo?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 80)
  const tipo = sp.tipo === 'clientes' || sp.tipo === 'prospectos' ? sp.tipo : ''
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const { supabase, canEdit, organizationId } = await requirePermission('empresas')

  // Página actual en el servidor (antes: todas las empresas con sus
  // contactos y deals anidados en cada carga).
  let pageQuery = supabase
    .from('companies')
    .select(`
      id, name, industry, website, country, employee_count, is_existing_client, created_at, custom_fields,
      contacts(id),
      deals(id, status)
    `, { count: 'exact' })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  // Comodines de ILIKE escapados: el término es texto literal.
  if (q) pageQuery = pageQuery.ilike('name', `%${q.replace(/[\\%_]/g, m => '\\' + m)}%`)
  if (tipo) pageQuery = pageQuery.eq('is_existing_client', tipo === 'clientes')

  const [companyFields, { data: companies, count }, { count: allCount }, { count: clientCount }, { data: openDeals }] = await Promise.all([
    getFieldDefinitions(supabase, 'company', organizationId ?? undefined),
    pageQuery,
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_existing_client', true),
    supabase.from('deals').select('id, company_id').eq('status', 'open'),
  ])

  const dealByCompany: Record<string, string> = {}
  for (const d of openDeals ?? []) if (d.company_id) dealByCompany[d.company_id] = d.id
  const totalAll = allCount ?? 0
  const totalClients = clientCount ?? 0
  const totalWithDeals = Object.keys(dealByCompany).length
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams()
    const merged = { q, tipo, page: String(page), ...over }
    for (const [k, v] of Object.entries(merged)) if (v && !(k === 'page' && String(v) === '1')) p.set(k, String(v))
    const s = p.toString()
    return s ? `/empresas?${s}` : '/empresas'
  }

  const tabs = [
    { key: '', label: 'Todas', n: totalAll },
    { key: 'clientes', label: 'Clientes', n: totalClients },
    { key: 'prospectos', label: 'Prospectos', n: totalAll - totalClients },
  ]

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Empresas"
        description={<><span className="font-medium text-slate-700 tabular-nums">{totalAll}</span> registradas</>}
        actions={canEdit && (
          <Link href="/leads/nuevo" className={buttonClass.primary}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo lead</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        )}
      />

      <StatStrip className="grid-cols-3 lg:grid-cols-3">
        <Stat label="Clientes" value={totalClients} href={href({ tipo: 'clientes', page: 1 })} />
        <Stat label="Prospectos" value={totalAll - totalClients} href={href({ tipo: 'prospectos', page: 1 })} />
        <Stat label="Con deals abiertos" value={totalWithDeals} tone={totalWithDeals ? 'accent' : 'neutral'} />
      </StatStrip>

      <div className="bg-card border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 border-b border-slate-100">
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Filtrar por tipo">
            {tabs.map(t => (
              <Link key={t.key} href={href({ tipo: t.key, page: 1 })} aria-current={tipo === t.key ? 'page' : undefined}
                className={cn('h-7 px-2.5 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
                  tipo === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                {t.label}<span className={cn('tabular-nums text-xs', tipo === t.key ? 'text-white/70' : 'text-slate-400')}>{t.n}</span>
              </Link>
            ))}
          </nav>
          <form action="/empresas" className="relative sm:w-72">
            {tipo && <input type="hidden" name="tipo" value={tipo} />}
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input name="q" defaultValue={q} placeholder="Buscar empresa" aria-label="Buscar empresa" type="search"
              className={cn(inputClass, 'h-8 pl-8')} />
          </form>
        </div>

        {(!companies || companies.length === 0) ? (
          <EmptyState icon={Building2}
            title={q || tipo ? 'Sin resultados' : 'No hay empresas aún'}
            description={q ? `Ninguna empresa coincide con “${q}”.` : q || tipo ? 'Prueba con otro filtro.' : 'Las empresas se crean junto con su primer lead.'}
            action={q || tipo
              ? <Link href="/empresas" className={buttonClass.secondary}>Quitar filtros</Link>
              : canEdit && <Link href="/leads/nuevo" className={buttonClass.primary}><Plus className="w-4 h-4" />Crear un lead</Link>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-xs font-medium text-slate-500 text-left px-5 py-3">Empresa</th>
                <th className="text-xs font-medium text-slate-500 text-left px-5 py-3 hidden md:table-cell">Industria</th>
                <th className="text-xs font-medium text-slate-500 text-left px-5 py-3 hidden lg:table-cell">Contactos</th>
                <th className="text-xs font-medium text-slate-500 text-left px-5 py-3 hidden lg:table-cell">Deals activos</th>
                <th className="text-xs font-medium text-slate-500 text-left px-5 py-3">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(companies as unknown as CompanyListItem[]).map(company => (
                <CompanyRow key={company.id} company={company} canEdit={canEdit} fields={companyFields} />
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 text-[13px] text-slate-500">
            <span className="tabular-nums">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex items-center gap-1">
              {page > 1
                ? <Link href={href({ page: page - 1 })} aria-label="Página anterior" className={buttonClass.ghost}><ChevronLeft className="w-4 h-4" /></Link>
                : <span className={cn(buttonClass.ghost, 'opacity-40')} aria-hidden><ChevronLeft className="w-4 h-4" /></span>}
              <span className="tabular-nums px-1">{page} / {totalPages}</span>
              {page < totalPages
                ? <Link href={href({ page: page + 1 })} aria-label="Página siguiente" className={buttonClass.ghost}><ChevronRight className="w-4 h-4" /></Link>
                : <span className={cn(buttonClass.ghost, 'opacity-40')} aria-hidden><ChevronRight className="w-4 h-4" /></span>}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
