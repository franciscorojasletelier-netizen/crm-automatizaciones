'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star, Trophy, Lock, Paperclip, MessageSquareWarning, AlertTriangle } from 'lucide-react'
import type { Stage } from '@/lib/stages'
import { STAGE_COLOR_TOKENS, colorOf } from '@/lib/stages'

async function callApi(method: 'POST' | 'PATCH', body: any) {
  const res = await fetch('/api/platform/stages', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
  return data
}

export default function StagesEditor({ orgId, stages }: { orgId: string; stages: Stage[] }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('slate')

  async function run(id: string, fn: () => Promise<any>) {
    setBusy(id)
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function createStage(e: React.FormEvent) {
    e.preventDefault()
    if (!newKey || !newLabel) return
    await run('new', () => callApi('POST', {
      organizationId: orgId, key: newKey, label: newLabel, color: newColor, sortOrder: stages.length,
    }))
    setShowNew(false)
    setNewKey('')
    setNewLabel('')
  }

  const activeStages = stages.filter(s => s.isActive)
  const hasWon = activeStages.some(s => s.isWon)
  const hasDefault = activeStages.some(s => s.isDefault)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      {(!hasWon || !hasDefault) && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-0.5">
            {!hasDefault && <p>Esta organización no tiene ninguna etapa inicial activa (⭐) — los leads nuevos no van a poder asignarse una etapa por defecto.</p>}
            {!hasWon && <p>Esta organización no tiene ninguna etapa de ganado activa (🏆) — cerrar un deal como ganado no va a crear el proyecto automáticamente ni contar en el forecast.</p>}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Embudo (etapas)</h2>
          <p className="text-xs text-slate-400 mt-0.5">La clave técnica no se puede editar una vez creada — solo el nombre visible.</p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> etapa inicial</span>
            <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> etapa de ganado</span>
            <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> exige adjunto</span>
            <span className="flex items-center gap-1"><MessageSquareWarning className="w-3 h-3" /> exige motivo</span>
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nueva etapa
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showNew && (
        <form onSubmit={createStage} className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Clave (técnica, inmutable)</label>
            <input value={newKey} onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="ej. escrituracion" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-40" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nombre visible</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="ej. Escrituración" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-44" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Color</label>
            <select value={newColor} onChange={e => setNewColor(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
              {STAGE_COLOR_TOKENS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy === 'new'} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50">
            Crear
          </button>
        </form>
      )}

      <div className="space-y-1.5">
        {stages.map(s => {
          const c = colorOf(s)
          return (
            <div key={s.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${s.isActive ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
              <div className="flex-1 min-w-0">
                <input
                  defaultValue={s.label}
                  onBlur={e => e.target.value !== s.label && run(s.id, () => callApi('PATCH', { stageId: s.id, label: e.target.value }))}
                  disabled={busy === s.id}
                  className="text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1 w-full"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> {s.key}
                </p>
              </div>

              <button
                onClick={() => run(s.id, () => callApi('PATCH', { stageId: s.id, organizationId: orgId, action: 'set_default' }))}
                disabled={busy === s.id || s.isDefault}
                title="Etapa inicial de un lead nuevo"
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${s.isDefault ? 'bg-blue-100 text-blue-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                <Star className="w-3.5 h-3.5" fill={s.isDefault ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={() => run(s.id, () => callApi('PATCH', { stageId: s.id, organizationId: orgId, action: 'set_won' }))}
                disabled={busy === s.id || s.isWon || s.isLost || !s.isTerminal}
                title={s.isLost ? 'Una etapa marcada como perdida no puede ser la de ganado' : 'Etapa de ganado'}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${s.isWon ? 'bg-emerald-100 text-emerald-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                <Trophy className="w-3.5 h-3.5" fill={s.isWon ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={() => run(s.id, () => callApi('PATCH', { stageId: s.id, requires_attachment: !s.requiresAttachment }))}
                disabled={busy === s.id}
                title={s.requiresAttachment ? 'Exige adjuntar un archivo para entrar a esta etapa — clic para quitarlo' : 'No exige adjunto — clic para exigirlo'}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${s.requiresAttachment ? 'bg-orange-100 text-orange-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => run(s.id, () => callApi('PATCH', { stageId: s.id, requires_reason: !s.requiresReason }))}
                disabled={busy === s.id}
                title={s.requiresReason ? 'Pide un motivo obligatorio al entrar a esta etapa — clic para quitarlo' : 'No pide motivo — clic para exigirlo'}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${s.requiresReason ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                <MessageSquareWarning className="w-3.5 h-3.5" />
              </button>

              <label className={`relative inline-flex items-center ${(s.isDefault || s.isWon) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                title={s.isDefault ? 'No se puede desactivar la etapa por defecto' : s.isWon ? 'No se puede desactivar la etapa de ganado' : ''}>
                <input type="checkbox" checked={s.isActive} disabled={busy === s.id || s.isDefault || s.isWon}
                  onChange={e => run(s.id, () => callApi('PATCH', { stageId: s.id, is_active: e.target.checked }))}
                  className="sr-only peer" />
                <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
