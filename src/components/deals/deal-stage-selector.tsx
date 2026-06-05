'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, XCircle, Upload, FileText, CheckCircle2,
  X, AlertCircle, Paperclip, Eye, Trash2,
} from 'lucide-react'

const stages = [
  { key: 'nuevo_lead',        label: 'Nuevo Lead',        active: 'bg-blue-500 text-white ring-blue-600',    inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { key: 'contactado',        label: 'Contactado',         active: 'bg-yellow-400 text-white ring-yellow-500', inactive: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' },
  { key: 'calificado',        label: 'Calificado',         active: 'bg-purple-500 text-white ring-purple-600', inactive: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { key: 'reunion_agendada',  label: 'Reunión Agendada',   active: 'bg-indigo-500 text-white ring-indigo-600', inactive: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
  { key: 'reunion_realizada', label: 'Reunión Realizada',  active: 'bg-cyan-500 text-white ring-cyan-600',    inactive: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada',  active: 'bg-orange-500 text-white ring-orange-600', inactive: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
  { key: 'negociacion',       label: 'Negociación',        active: 'bg-pink-500 text-white ring-pink-600',    inactive: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
  { key: 'cerrado_ganado',    label: 'Ganado ✓',           active: 'bg-green-500 text-white ring-green-600',  inactive: 'bg-green-50 text-green-600 hover:bg-green-100' },
  { key: 'cerrado_perdido',   label: 'Perdido',            active: 'bg-red-500 text-white ring-red-600',      inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
  { key: 'no_calificado',     label: 'No Calificado',      active: 'bg-gray-500 text-white ring-gray-600',    inactive: 'bg-gray-50 text-gray-600 hover:bg-gray-100' },
  { key: 'frio',              label: 'Frío',               active: 'bg-slate-500 text-white ring-slate-600',  inactive: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

const closedStages = ['cerrado_ganado', 'cerrado_perdido', 'no_calificado']

const ACCEPTED = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg'
const MAX_MB = 15

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Modal de propuesta ─────────────────────────────────────────
interface ProposalModalProps {
  dealId: string
  onConfirm: (file: File) => Promise<void>
  onCancel: () => void
  uploading: boolean
  existingFilename?: string | null
}

function ProposalModal({ dealId, onConfirm, onCancel, uploading, existingFilename }: ProposalModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setError('')
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_MB} MB`)
      return
    }
    setFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  async function handleConfirm() {
    if (!file) return
    await onConfirm(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!uploading ? onCancel : undefined} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <Paperclip className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Adjuntar propuesta</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para marcar como <span className="font-semibold text-orange-600">Propuesta Enviada</span> debes adjuntar el documento. Sin archivo no se puede avanzar.
            </p>
          </div>
          {!uploading && (
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {existingFilename && !file && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <FileText className="w-5 h-5 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-700">Propuesta anterior</p>
                <p className="text-xs text-orange-600 truncate">{existingFilename}</p>
              </div>
              <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Reemplazar</span>
            </div>
          )}

          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-orange-400 bg-orange-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-orange-300 hover:bg-orange-50/50'
              }`}>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-colors ${dragOver ? 'bg-orange-100' : 'bg-slate-100'}`}>
                <Upload className={`w-6 h-6 transition-colors ${dragOver ? 'text-orange-500' : 'text-slate-400'}`} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {dragOver ? '¡Suelta aquí!' : 'Arrastra tu propuesta aquí'}
              </p>
              <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
              <p className="text-[10px] text-slate-300 mt-3">PDF, Word, PowerPoint, Excel · Máx. {MAX_MB} MB</p>
            </div>
          ) : (
            /* Archivo seleccionado */
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900 truncate">{file.name}</p>
                  <p className="text-xs text-emerald-600">{formatBytes(file.size)}</p>
                </div>
                <button onClick={() => setFile(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-200 text-emerald-500 hover:text-emerald-700 transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-600">Listo para adjuntar</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
            style={{ background: (!file || uploading) ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo propuesta...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Confirmar propuesta enviada</>
            )}
          </button>
          {!uploading && (
            <button onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
interface Props {
  dealId: string
  currentStage: string
  proposalFilename?: string | null
  proposalUrl?: string | null
}

export default function DealStageSelector({ dealId, currentStage, proposalFilename, proposalUrl }: Props) {
  const [stage, setStage] = useState(currentStage)
  useEffect(() => { setStage(currentStage) }, [currentStage])

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [showLostReason, setShowLostReason] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleStageChange(newStage: string) {
    if (newStage === stage) return

    if (newStage === 'propuesta_enviada') {
      setShowProposalModal(true)
      return
    }
    if (newStage === 'cerrado_perdido') {
      setShowLostReason(true)
      setStage(newStage)
      return
    }

    await applyStageChange(newStage, null)
  }

  async function applyStageChange(newStage: string, reason: string | null, extraFields?: Record<string, any>) {
    setLoading(true)
    setError('')
    const updates: Record<string, any> = { stage: newStage, ...extraFields }

    if (closedStages.includes(newStage)) {
      updates.status = newStage === 'cerrado_ganado' ? 'won' : 'lost'
    }
    if (reason) updates.lost_reason = reason

    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals').update(updates).eq('id', dealId).select('company_id, estimated_value, owner_id').single()

    if (updateError) {
      setError(updateError.message)
      setStage(currentStage)
      setLoading(false)
      return
    }

    if (newStage === 'cerrado_ganado' && updatedDeal) {
      await supabase.from('projects').insert({
        company_id: updatedDeal.company_id, deal_id: dealId, owner_id: updatedDeal.owner_id,
        name: `Proyecto - ${new Date().toLocaleDateString('es-CL')}`,
        phase: 'discovery', status: 'activo', budget: updatedDeal.estimated_value,
        start_date: new Date().toISOString().split('T')[0],
      })
    }

    setStage(newStage)
    setLoading(false)
    setShowLostReason(false)
    router.refresh()
  }

  async function handleProposalUpload(file: File) {
    setUploading(true)
    setError('')

    try {
      const ext = file.name.split('.').pop()
      const path = `${dealId}/${Date.now()}_${file.name}`

      const { data: storageData, error: storageError } = await supabase.storage
        .from('propuestas')
        .upload(path, file, { upsert: true })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage.from('propuestas').getPublicUrl(path)

      await applyStageChange('propuesta_enviada', null, {
        proposal_url: urlData.publicUrl,
        proposal_filename: file.name,
        proposal_size: file.size,
        proposal_uploaded_at: new Date().toISOString(),
      })

      setShowProposalModal(false)
    } catch (err: any) {
      setError(`Error subiendo archivo: ${err?.message ?? 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambiar etapa</h2>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stages.map(s => {
            const isProposal = s.key === 'propuesta_enviada'
            return (
              <button key={s.key} onClick={() => handleStageChange(s.key)} disabled={loading}
                className={`relative text-xs px-3 py-1.5 rounded-xl font-semibold ring-1 ring-transparent transition-all duration-150 disabled:cursor-not-allowed ${
                  stage === s.key ? `${s.active} ring-1` : s.inactive
                }`}>
                {s.label}
                {/* Indicador de adjunto requerido */}
                {isProposal && stage !== s.key && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white rounded-full text-[8px] font-black flex items-center justify-center" title="Requiere adjunto">
                    📎
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Propuesta adjunta actual */}
        {proposalFilename && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Propuesta adjunta</p>
            <div className="flex items-center gap-2.5 p-2.5 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-900 truncate">{proposalFilename}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {proposalUrl && (
                  <a href={proposalUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-800 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-colors">
                    <Eye className="w-3 h-3" /> Ver
                  </a>
                )}
                <button onClick={() => setShowProposalModal(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors">
                  <Upload className="w-3 h-3" /> Reemplazar
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}

        {/* Modal pérdida */}
        {showLostReason && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-red-800">¿Por qué se perdió este deal?</p>
            </div>
            <select value={lostReason} onChange={e => setLostReason(e.target.value)}
              className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="">Seleccionar motivo</option>
              <option value="precio">Precio</option>
              <option value="competencia">Competencia</option>
              <option value="sin_urgencia">Sin urgencia</option>
              <option value="contacto_no_decisor">Contacto no decisor</option>
              <option value="proyecto_cancelado">Proyecto cancelado</option>
              <option value="negociacion_prolongada">Negociación prolongada</option>
              <option value="otro">Otro</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => applyStageChange('cerrado_perdido', lostReason)} disabled={!lostReason || loading}
                className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                <XCircle className="w-3.5 h-3.5" /> Confirmar pérdida
              </button>
              <button onClick={() => { setShowLostReason(false); setStage(currentStage) }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de propuesta */}
      {showProposalModal && (
        <ProposalModal
          dealId={dealId}
          onConfirm={handleProposalUpload}
          onCancel={() => { setShowProposalModal(false); setStage(currentStage) }}
          uploading={uploading}
          existingFilename={proposalFilename}
        />
      )}
    </>
  )
}
