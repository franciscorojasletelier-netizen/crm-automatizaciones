'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, Loader2, ClipboardList,
  Clock, User, ExternalLink, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  projectId: string
  projectName: string
  specNotes: string | null
  specRequestedAt: string | null
  specRequestedByName: string | null
  currentUserId: string
  canResolve: boolean
}

export default function DealSpecBanner({
  projectId, projectName, specNotes, specRequestedAt,
  specRequestedByName, currentUserId, canResolve,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [response, setResponse] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [responseError, setResponseError] = useState(false)
  const [saveError, setSaveError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleResolve() {
    if (response.trim().length < 10) { setResponseError(true); return }
    setLoading(true)
    setSaveError('')

    const { error: updateErr } = await supabase.from('projects').update({
      status:            'activo',
      spec_resolved_at:  new Date().toISOString(),
      spec_notes:        null,
      spec_requested_at: null,
      spec_requested_by: null,
    }).eq('id', projectId)

    if (updateErr) {
      setSaveError(`No se pudo devolver el proyecto (${updateErr.message}). Intentá de nuevo.`)
      setLoading(false)
      return
    }

    // Agregar una nota interna al proyecto con la respuesta
    const { error: noteErr } = await supabase.from('project_notes').insert({
      project_id: projectId,
      user_id:    currentUserId,
      content:    `✅ Especificaciones completadas por comercial:\n${response.trim()}`,
    })
    if (noteErr) {
      // El proyecto ya volvió a producción — esto es secundario, se avisa
      // pero no se bloquea el flujo principal por la nota.
      setSaveError(`El proyecto se devolvió, pero la nota no se pudo guardar (${noteErr.message}).`)
    }

    // Notificar a producción y gerentes
    const { data: targets } = await supabase
      .from('profiles').select('id')
      .in('role', ['produccion', 'gerente', 'super_admin', 'admin'])
      .eq('is_active', true)

    if (targets && targets.length > 0) {
      await supabase.from('notifications').insert(
        targets.map((t: any) => ({
          user_id:     t.id,
          type:        'stage_changed',
          title:       '✅ Especificaciones listas — Proyecto reactivado',
          body:        `El área comercial completó las especificaciones de "${projectName}". Respuesta: ${response.trim().slice(0, 100)}`,
          entity_type: 'project',
          entity_id:   projectId,
        }))
      )
    }

    setResolved(true)
    setLoading(false)
    router.refresh()
  }

  if (resolved) return null

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">
              ⚠️ El proyecto necesita especificaciones de tu parte
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              El equipo de producción devolvió este deal a comercial. Lee las notas y cuando estés listo, devuelve el proyecto a producción.
            </p>
          </div>
        </div>
        <Link href={`/proyectos/${projectId}`}
          className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-2.5 py-1.5 rounded-lg transition-colors">
          Ver proyecto <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Notas de producción */}
      {specNotes && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              Qué falta por definir (según Producción)
            </p>
          </div>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{specNotes}</p>
          <div className="flex items-center gap-4 pt-2 border-t border-amber-100 text-[11px] text-slate-400 flex-wrap">
            {specRequestedByName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> Solicitado por {specRequestedByName}
              </span>
            )}
            {specRequestedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(specRequestedAt).toLocaleDateString('es-CL', {
                  day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Acción */}
      {canResolve && (
        <div className="space-y-3">
          {!showForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-md transition-all">
                <CheckCircle2 className="w-4 h-4" /> Responder a Producción
              </button>
              <Link href={`/proyectos/${projectId}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors">
                Ver detalles del proyecto <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                ¿Qué resolviste o agregaste? <span className="font-normal text-slate-400 normal-case">(mín. 10 caracteres)</span>
              </p>
              <textarea
                value={response}
                onChange={e => { setResponse(e.target.value); setResponseError(false) }}
                placeholder="Describe qué información completaste o aclaraste para producción..."
                rows={3}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none text-slate-800 placeholder:text-slate-400 ${
                  responseError ? 'border-red-300 bg-red-50/30 focus:ring-red-200' : 'border-slate-200 bg-slate-50 focus:ring-emerald-200 focus:border-emerald-300'
                }`}
              />
              {responseError && <p className="text-xs text-red-500">Mínimo 10 caracteres requeridos</p>}
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex gap-2">
                <button onClick={handleResolve} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-md disabled:opacity-50 transition-all">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><CheckCircle2 className="w-4 h-4" /> Confirmar y devolver</>}
                </button>
                <button onClick={() => { setShowForm(false); setResponse(''); setResponseError(false) }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
