export const dynamic = 'force-dynamic'
import { createClient, requirePermission } from '@/lib/supabase/server'
import { getVisibleProjectIds } from '@/lib/visibility'
import Link from 'next/link'
import { FolderOpen, ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  diseno: 'Diseño de Flujos',
  desarrollo: 'Desarrollo',
  pruebas: 'Pruebas',
  entrega: 'Entrega',
  soporte: 'Soporte Post-lanzamiento',
}

const phaseColors: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  diseno:    'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  desarrollo:'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  pruebas:   'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  entrega:   'bg-green-100 text-green-700 ring-1 ring-green-200',
  soporte:   'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const phaseProgress: Record<string, number> = {
  discovery: 10, diseno: 25, desarrollo: 50, pruebas: 75, entrega: 90, soporte: 100,
}

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

function isDueSoon(due: string | null) {
  if (!due) return false
  const diff = new Date(due).getTime() - Date.now()
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 7
}

export default async function ProyectosPage() {
  const { role, supabase, user } = await requirePermission('proyectos')

  const visibleIds = await getVisibleProjectIds(supabase, user?.id ?? '', role)

  let baseQuery = supabase
    .from('projects')
    .select(`
      id, name, phase, status, budget, due_date, start_date,
      companies(name),
      profiles:owner_id(full_name)
    `)
    .order('due_date', { ascending: true })

  if (visibleIds !== null) {
    baseQuery = visibleIds.length > 0
      ? baseQuery.in('id', visibleIds)
      : baseQuery.eq('id', 'no-match')
  }

  const { data: projects } = await baseQuery

  const active = projects?.filter(p => p.status === 'activo') ?? []
  const others = projects?.filter(p => p.status !== 'activo') ?? []

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proyectos</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          <span className="font-semibold text-slate-700">{active.length}</span> activos ·{' '}
          <span className="font-semibold text-slate-700">{projects?.length ?? 0}</span> en total
        </p>
      </div>

      {/* Empty state */}
      {(!projects || projects.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">Sin proyectos aún</p>
          <p className="text-sm text-slate-400 text-center max-w-xs">Los proyectos se crean automáticamente al ganar un deal en el pipeline</p>
        </div>
      )}

      {/* Proyectos activos */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Activos</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {active.map((project: any) => {
              const overdue = isOverdue(project.due_date)
              const soon = isDueSoon(project.due_date)
              const progress = phaseProgress[project.phase] ?? 0
              return (
                <Link key={project.id} href={`/proyectos/${project.id}`}
                  className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-100">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">{project.name}</p>
                      {project.companies?.name && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">{project.companies.name}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${phaseColors[project.phase] ?? 'bg-slate-100 text-slate-600'}`}>
                      {phaseLabels[project.phase] ?? project.phase}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-3">
                    <div className="flex items-center gap-3">
                      {project.budget && (
                        <span className="font-semibold text-slate-700">${Number(project.budget).toLocaleString()}</span>
                      )}
                      {project.profiles?.full_name && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-indigo-600">
                              {project.profiles.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-slate-400">{project.profiles.full_name.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                    {project.due_date && (
                      <span className={`flex items-center gap-1 font-semibold px-2 py-1 rounded-lg ${
                        overdue ? 'bg-red-50 text-red-600 border border-red-100' :
                        soon    ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {new Date(project.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">{progress}% completado</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Otros proyectos */}
      {others.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Otros</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Proyecto</th>
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Fase</th>
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Fecha límite</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {others.map((project: any) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-700">{project.name}</p>
                      {project.companies?.name && <p className="text-xs text-slate-400">{project.companies.name}</p>}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${phaseColors[project.phase] ?? 'bg-slate-100 text-slate-600'}`}>
                        {phaseLabels[project.phase] ?? project.phase}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-slate-500">
                      {project.due_date ? new Date(project.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/proyectos/${project.id}`}>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
