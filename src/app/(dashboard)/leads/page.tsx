import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead',
  contactado: 'Contactado',
  calificado: 'Calificado',
  reunion_agendada: 'Reunión Agendada',
  reunion_realizada: 'Reunión Realizada',
  propuesta_enviada: 'Propuesta Enviada',
  negociacion: 'Negociación',
  cerrado_ganado: 'Ganado',
  cerrado_perdido: 'Perdido',
  no_calificado: 'No Calificado',
  frio: 'Frío',
}

const stageColors: Record<string, string> = {
  nuevo_lead: 'bg-blue-100 text-blue-700',
  contactado: 'bg-yellow-100 text-yellow-700',
  calificado: 'bg-purple-100 text-purple-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_realizada: 'bg-cyan-100 text-cyan-700',
  propuesta_enviada: 'bg-orange-100 text-orange-700',
  negociacion: 'bg-pink-100 text-pink-700',
  cerrado_ganado: 'bg-green-100 text-green-700',
  cerrado_perdido: 'bg-red-100 text-red-700',
  no_calificado: 'bg-gray-100 text-gray-600',
  frio: 'bg-slate-100 text-slate-600',
}

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id, stage, score, estimated_value, next_action, source,
      created_at, last_contacted_at,
      companies(name, industry),
      contacts:primary_contact_id(full_name, email),
      profiles:owner_id(full_name)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{deals?.length ?? 0} deals activos</p>
        </div>
        <Link
          href="/leads/nuevo"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo lead
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Etapa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Valor est.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Responsable</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Próxima acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(!deals || deals.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No hay leads aún.{' '}
                  <Link href="/leads/nuevo" className="text-gray-900 underline">Crear el primero</Link>
                </td>
              </tr>
            )}
            {deals?.map((deal: any) => (
              <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{deal.companies?.name ?? '—'}</p>
                  {deal.companies?.industry && (
                    <p className="text-xs text-gray-400">{deal.companies.industry}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{deal.contacts?.full_name ?? '—'}</p>
                  {deal.contacts?.email && (
                    <p className="text-xs text-gray-400">{deal.contacts.email}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                    {stageLabels[deal.stage] ?? deal.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${deal.score >= 60 ? 'text-green-600' : deal.score >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {deal.score}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {deal.profiles?.full_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                  {deal.next_action ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
