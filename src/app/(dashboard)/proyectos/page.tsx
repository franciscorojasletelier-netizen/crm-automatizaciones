import { createClient } from '@/lib/supabase/server'
import { FolderOpen } from 'lucide-react'

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  diseno: 'Diseño de Flujos',
  desarrollo: 'Desarrollo',
  pruebas: 'Pruebas',
  entrega: 'Entrega',
  soporte: 'Soporte Post-lanzamiento',
}

const phaseColors: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700',
  diseno: 'bg-purple-100 text-purple-700',
  desarrollo: 'bg-yellow-100 text-yellow-700',
  pruebas: 'bg-orange-100 text-orange-700',
  entrega: 'bg-green-100 text-green-700',
  soporte: 'bg-gray-100 text-gray-600',
}

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

export default async function ProyectosPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, phase, status, budget, due_date, start_date,
      companies(name),
      profiles:owner_id(full_name)
    `)
    .order('due_date', { ascending: true })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Proyectos</h1>
        <p className="text-sm text-gray-500">{projects?.length ?? 0} proyectos</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Proyecto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fase</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Responsable</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha límite</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Presupuesto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(!projects || projects.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  Los proyectos se crean automáticamente al ganar un deal
                </td>
              </tr>
            )}
            {projects?.map((project: any) => {
              const overdue = isOverdue(project.due_date)
              return (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{project.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {project.companies?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColors[project.phase] ?? 'bg-gray-100 text-gray-600'}`}>
                      {phaseLabels[project.phase] ?? project.phase}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {project.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {project.due_date
                        ? new Date(project.due_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                      {overdue && ' ⚠'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {project.budget ? `$${Number(project.budget).toLocaleString()}` : '—'}
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
