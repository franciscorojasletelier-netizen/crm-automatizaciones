'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Phone, Mail, Users, FileText, Plus, X, Send } from 'lucide-react'

const typeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  email:   { icon: Mail,     label: 'Email',    color: 'text-blue-600',   bg: 'bg-blue-50'   },
  call:    { icon: Phone,    label: 'Llamada',  color: 'text-green-600',  bg: 'bg-green-50'  },
  meeting: { icon: Users,    label: 'Reunión',  color: 'text-purple-600', bg: 'bg-purple-50' },
  note:    { icon: FileText, label: 'Nota',     color: 'text-amber-600',  bg: 'bg-amber-50'  },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function DealInteractions({ dealId, interactions }: { dealId: string; interactions: any[] }) {
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
    if (data) { setList([data, ...list]); setContent(''); setShowing(false) }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Interacciones</h2>
          {list.length > 0 && (
            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{list.length}</span>
          )}
        </div>
        <button onClick={() => setShowing(!showing)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
            showing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}>
          {showing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showing ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      {showing && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          {/* Selector de tipo */}
          <div className="flex gap-2">
            {Object.entries(typeConfig).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button key={key} onClick={() => setType(key)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl ring-1 transition-all ${
                    type === key
                      ? `${cfg.bg} ${cfg.color} ring-current`
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                  }`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="Escribe los detalles de la interacción..."
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading || !content.trim()}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {list.length === 0 && !showing && (
          <div className="px-5 py-10 text-center">
            <FileText className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Sin interacciones aún</p>
          </div>
        )}
        {list.map((i: any) => {
          const cfg = typeConfig[i.type] ?? typeConfig.note
          const Icon = cfg.icon
          return (
            <div key={i.id} className="px-5 py-3.5 flex gap-3.5 hover:bg-slate-50/50 transition-colors">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                  {i.profiles?.full_name && (
                    <span className="text-xs text-slate-400 font-medium">{i.profiles.full_name}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{i.content}</p>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 font-medium mt-1">{timeAgo(i.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
