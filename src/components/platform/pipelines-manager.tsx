'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import StagesEditor from './stages-editor'
import type { Pipeline, Stage } from '@/lib/stages'

export default function PipelinesManager({ orgId, pipelines: initialPipelines, allStages }: {
  orgId: string; pipelines: Pipeline[]; allStages: Stage[]
}) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState(initialPipelines)
  const [selected, setSelected] = useState(initialPipelines[0]?.id ?? '')
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function createPipeline(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/platform/pipelines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setPipelines(prev => [...prev, { id: data.id, name: name.trim(), sortOrder: prev.length + 1, isDefault: false, isActive: true }])
      setSelected(data.id)
      setName(''); setShowNew(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const stagesForSelected = allStages.filter(s => s.pipelineId === selected)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Pipelines</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Cada pipeline tiene su propio embudo — útil para líneas de negocio distintas (ej. proyectos nuevos vs. renovación).</p>
          </div>
          <button onClick={() => setShowNew(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> Nuevo pipeline
          </button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

        {showNew && (
          <form onSubmit={createPipeline} className="flex items-end gap-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Renovación de contratos"
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
            </div>
            <button type="submit" disabled={saving} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear'}
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-1.5">
          {pipelines.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                selected === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {p.name}{p.isDefault ? ' (default)' : ''}
            </button>
          ))}
        </div>
      </div>

      {selected && <StagesEditor orgId={orgId} pipelineId={selected} stages={stagesForSelected} />}
    </div>
  )
}
