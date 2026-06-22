'use client'

import { NAV_SECTIONS, type SectionMode } from '@/lib/roles'
import { Eye, Pencil } from 'lucide-react'

const ADMIN_ONLY = new Set(['usuarios', 'actividad', 'configuracion'])

interface Props {
  value: Record<string, SectionMode>
  onChange: (key: string, mode: SectionMode | null) => void
  isAdmin: boolean
}

export default function SectionChecklist({ value, onChange, isAdmin }: Props) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Acceso a secciones</label>
      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
        {NAV_SECTIONS.map(s => {
          const mode = value[s.key]
          const disabled = ADMIN_ONLY.has(s.key) && !isAdmin
          return (
            <div key={s.key} className={`flex items-center gap-2 px-1 py-0.5 rounded-lg ${disabled ? 'opacity-40' : ''}`}>
              <span className="flex-1 text-[11px] font-medium text-slate-700 truncate">{s.label}</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
                <button type="button" disabled={disabled} onClick={() => onChange(s.key, null)}
                  className={`px-2 py-1 text-[10px] font-semibold transition-colors ${!mode ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                  Sin acceso
                </button>
                <button type="button" disabled={disabled} onClick={() => onChange(s.key, 'read')}
                  className={`px-2 py-1 text-[10px] font-semibold border-l border-slate-200 flex items-center gap-1 transition-colors ${mode === 'read' ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                  <Eye className="w-3 h-3" /> Lectura
                </button>
                <button type="button" disabled={disabled} onClick={() => onChange(s.key, 'full')}
                  className={`px-2 py-1 text-[10px] font-semibold border-l border-slate-200 flex items-center gap-1 transition-colors ${mode === 'full' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                  <Pencil className="w-3 h-3" /> Completo
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">
        Lectura = ve sin editar · Completo = ve y edita. Gestión (Equipo, Actividad, Configuración) requiere Administrador.
      </p>
    </div>
  )
}
