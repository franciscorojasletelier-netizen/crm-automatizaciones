'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Phone, Mail, Users, FileText, Plus } from 'lucide-react'

const typeIcons: Record<string, any> = {
  email: Mail,
  call: Phone,
  meeting: Users,
  note: FileText,
}

const typeLabels: Record<string, string> = {
  email: 'Email',
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function DealInteractions({
  dealId,
  interactions,
}: {
  dealId: string
  interactions: any[]
}) {
  const [list, setList] = useState(interactions)
  const [showing, setShowing] = useState(false)
  const [type, setType] = useState('note')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd() {
    if (!content.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('interactions')
      .insert({ deal_id: dealId, type, content, direction: 'outbound' })
      .select('*, profiles:user_id(full_name)')
      .single()

    if (data) {
      setList([data, ...list])
      setContent('')
      setShowing(false)
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Interacciones</h2>
        <button
          onClick={() => setShowing(!showing)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {showing && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-3 bg-gray-50">
          <div className="flex gap-2">
            {(['note', 'email', 'call', 'meeting'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  type === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Escribe los detalles..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !content.trim()}
              className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowing(false)}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {list.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin interacciones aún</p>
        )}
        {list.map((i: any) => {
          const Icon = typeIcons[i.type] ?? FileText
          return (
            <div key={i.id} className="px-4 py-3 flex gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-600">{typeLabels[i.type]}</span>
                  {i.profiles?.full_name && (
                    <span className="text-xs text-gray-400">· {i.profiles.full_name}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{i.content}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{timeAgo(i.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
