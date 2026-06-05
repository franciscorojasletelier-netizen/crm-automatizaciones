'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftRight, AlertTriangle, CheckCircle2, Loader2,
  X, ClipboardList, Clock, User,
} from 'lucide-react'

interface Props {
  projectId: string
  dealId: string | null
  dealOwnerId: string | null
  currentStatus: string
  specNotes: string | null
  specRequestedAt: string | null
  specRequestedByName: string | null
  currentUserId: string
  canRequest: boolean   // produccion o superior
  canResolve: boolean   // comercial o gerente
}

export default function ProjectSpecRequest({
  projectId, dealId, dealOwnerId, currentStatus,
  specNotes, specRequestedAt, specRequestedByName,
  currentUserId, canRequest, canResolve,
}: Props) {
  const isPending = currentStatus === 'pendiente_especificaciones'
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  // ── Producción: solicitar especificaciones ──────────────────
  async function handleRequest() {
    if (notes.trim().length < 15) { setError('Describe con más detalle qué falta (mínimo 15 caracteres)'); return }
    setLoading(true); setError('')

    const { error: err } = await supabase.from('projects').update({
      status:            'pendiente_especificaciones',
      spec_notes:        notes.trim(),
      spec_requested_at: new Date().toISOString(),
      spec_requested_by: currentUserId,
      spec_resolved_at:  null,
    }).eq('id', projectId)

    if (err) { setError(err.message); setLoading(false); return }

    // Notificar al dueño del deal (comercial) + gerentes
    const notifTargets: string[] = []
    if (dealOwnerId) notifTargets.push(dealOwnerId)

    // Incluir gerentes
    const { data: gerentes } = await supabase
      .from('profiles').select('id')
      .in('role', ['gerente', 'super_admin', 'admin'])
      .eq('is_active', true)
    gerentes?.forEach((g: any) => { if (!notifTargets.includes(g.id)) notifTargets.push(g.id) })

    if (notifTargets.length > 0) {
      await supabase.from('notifications').insert(
        notifTargets.map(uid => ({
          user_id:     uid,
          type:        'stage_changed',
          title:       '⚠️ Proyecto necesita especificaciones',
          body:        `Producción devolvió el proyecto a comercial: ${notes.trim().slice(0, 120)}`,
          entity_type: 'project',
          entity_id:   projectId,
        }))
      )
    }

    setOpen(false); setNotes(''); setLoading(false)
    router.refresh()
  }

  // ── Comercial: marcar como listo y devolver a producción ────
  async function handleResolve() {
    setLoading(true)

    await supabase.from('projects').update({
      status:           'activo',
      spec_resolved_at: new Date().toISOString(),
      spec_notes:       null,
      spec_requested_at: null,
      spec_requested_by: null,
    }).eq('id', projectId)

    // Notificar a producción/gerentes
    const { data: produccion } = await supabase
      .from('profiles').select('id')
      .in('role', ['produccion', 'gerente', 'super_admin', 'admin'])
      .eq('is_active', true)

    if (produccion && produccion.length > 0) {
      await supabase.from('notifications').insert(
        produccion.map((p: any) => ({
          user_id:     p.id,
          type:        'stage_changed',
          title:       '✅ Especificaciones listas — Proyecto reactivado',
          body:        'El área comercial completó las especificaciones pendientes. El proyecto está listo para continuar.',
          entity_type: 'project',
          entity_id:   projectId,
        }))
      )
    }

    setLoading(false)
    router.refresh()
  }

  // ── Banner: proyecto pendiente de especificaciones ──────────
  if (isPending) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4">
        {/* Header alerta */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Pendiente de especificaciones</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Producción devolvió este proyecto al área comercial para aclarar algunos puntos antes de continuar.
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-bold bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full">
            EN ESPERA
          </span>
        </div>

        {/* Notas de producción */}
        {specNotes && (
          <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">¿Qué falta por definir?</p>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{specNotes}</p>
            <div className="flex items-center gap-3 pt-1 border-t border-amber-100 text-[11px] text-slate-400">
              {specRequestedByName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {specRequestedByName}
                </span>
              )}
              {specRequestedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(specRequestedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          {canResolve && (
            <button onClick={handleResolve} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-md disabled:opacity-50 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Listo — Devolver a Producción
            </button>
          )}
          {canRequest && (
            <button onClick={() => setOpen(true)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200 transition-all">
              <ClipboardList className="w-4 h-4" />
              Actualizar notas
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Estado normal: botón para devolver a comercial ──────────
  if (!canRequest) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-amber-50 transition-colors group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-amber-800 transition-colors">
              Devolver a Comercial
            </p>
            <p className="text-xs text-slate-400">Solicitar aclaraciones o especificaciones adicionales</p>
          </div>
          <AlertTriangle className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
        </button>
      ) : (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-slate-900">Devolver a Comercial</p>
            </div>
            <button onClick={() => { setOpen(false); setNotes(''); setError('') }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              El proyecto quedará en estado <strong>Pendiente de Especificaciones</strong>.
              El ejecutivo comercial y el gerente serán notificados automáticamente con tus notas.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              ¿Qué falta por definir? *
              <span className="font-normal text-slate-400 normal-case ml-1">(mínimo 15 caracteres)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe claramente qué puntos necesitan ser aclarados por el área comercial antes de continuar con el proyecto...

Ejemplo:
- Colores y tipografías de marca no definidos
- Falta confirmar integraciones con sistemas del cliente
- Presupuesto de hosting no acordado"
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none"
            />
            <p className={`text-[10px] mt-1 text-right ${notes.length >= 15 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {notes.length} / 15 mín.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button onClick={handleRequest} disabled={loading || notes.trim().length < 15}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              {loading ? 'Enviando...' : 'Enviar a Comercial'}
            </button>
            <button onClick={() => { setOpen(false); setNotes(''); setError('') }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
