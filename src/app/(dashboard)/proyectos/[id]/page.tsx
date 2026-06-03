import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProjectPhaseSelector from '@/components/projects/project-phase-selector'
import ProjectDeliverables from '@/components/projects/project-deliverables'
import ProjectNotes from '@/components/projects/project-notes'

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  diseno: 'Diseño de Flujos',
  desarrollo: 'Desarrollo',
  pruebas: 'Pruebas',
  entrega: 'Entrega',
  soporte: 'Soporte Post-lanzamiento',
}

const statusColors: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  entregado: 'bg-blue-100 text-blue-700',
  cancelado: 'bg-red-100 text-red-700',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(`*, companies(name, industry), profiles:owner_id(full_name), deals(id)`)
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: deliverables } = await supabase
    .from('project_deliverables')
    .select('*')
    .eq('project_id', id)
    .order('created_at')

  const { data: notes } = await supabase
    .from('project_notes')
    .select('*, profiles:user_id(full_name)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const completedDeliverables = deliverables?.filter(d => d.is_completed).length ?? 0
  const totalDeliverables = deliverables?.length ?? 0
  const progress = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <Link href="/proyectos" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a proyectos
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {project.companies?.name} · {project.profiles?.full_name ?? 'Sin responsable'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[project.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {project.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="col-span-1 space-y-4">

          {/* Detalles */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles</h2>
            {[
              { label: 'Fase actual', value: phaseLabels[project.phase] },
              { label: 'Presupuesto', value: project.budget ? `$${Number(project.budget).toLocaleString()}` : null },
              { label: 'Horas estimadas', value: project.estimated_hours ? `${project.estimated_hours}h` : null },
              { label: 'Horas reales', value: project.actual_hours ? `${project.actual_hours}h` : null },
              { label: 'Inicio', value: project.start_date ? new Date(project.start_date).toLocaleDateString('es-CL') : null },
              { label: 'Fecha límite', value: project.due_date ? new Date(project.due_date).toLocaleDateString('es-CL') : null },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm text-gray-800">{value}</p>
              </div>
            ) : null)}
          </div>

          {/* Progreso */}
          {totalDeliverables > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Progreso</h2>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">{completedDeliverables} de {totalDeliverables} entregables</span>
                <span className="text-xs font-semibold text-gray-900">{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-gray-900 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Satisfacción */}
          {project.customer_satisfaction_score && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Satisfacción cliente</h2>
              <p className="text-2xl font-semibold text-gray-900">
                {'★'.repeat(project.customer_satisfaction_score)}{'☆'.repeat(5 - project.customer_satisfaction_score)}
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="col-span-2 space-y-4">
          <ProjectPhaseSelector projectId={project.id} currentPhase={project.phase} currentStatus={project.status} />
          <ProjectDeliverables projectId={project.id} deliverables={deliverables ?? []} />
          <ProjectNotes projectId={project.id} notes={notes ?? []} />
        </div>
      </div>
    </div>
  )
}
