'use client'

import { NAV_SECTIONS, type SectionMode } from '@/lib/roles'
import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_ONLY = new Set(['usuarios', 'actividad', 'configuracion'])

// Mismos grupos que el menú lateral, para reconocer cada módulo.
const GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Comercial', keys: ['dashboard', 'pipeline', 'leads', 'empresas'] },
  { label: 'Operación', keys: ['tareas', 'proyectos', 'cobranza', 'calendario', 'notificaciones'] },
  { label: 'Análisis', keys: ['reportes', 'automatizaciones'] },
  { label: 'Organización', keys: ['organigrama', 'usuarios', 'actividad', 'configuracion'] },
]

interface Props {
  value: Record<string, SectionMode>
  onChange: (key: string, mode: SectionMode | null) => void
  isAdmin: boolean
}

export default function SectionChecklist({ value, onChange, isAdmin }: Props) {
  const byKey = new Map(NAV_SECTIONS.map(s => [s.key, s]))
  // Cualquier sección nueva que no esté en GROUPS igual aparece (al final).
  const grouped = new Set(GROUPS.flatMap(g => g.keys))
  const groups = [...GROUPS, { label: 'Otros', keys: NAV_SECTIONS.map(s => s.key).filter(k => !grouped.has(k)) }]
    .filter(g => g.keys.some(k => byKey.has(k)))

  const setAll = (mode: SectionMode | null) =>
    NAV_SECTIONS.forEach(s => { if (!(ADMIN_ONLY.has(s.key) && !isAdmin)) onChange(s.key, mode) })

  return (
    <fieldset>
      <div className="flex items-center justify-between mb-1.5">
        <legend className="text-xs font-semibold text-slate-600">Acceso a módulos</legend>
        <div className="flex gap-2 text-[11px]">
          <button type="button" onClick={() => setAll('full')} className="font-medium text-accent-700 hover:underline">Todo completo</button>
          <button type="button" onClick={() => setAll(null)} className="font-medium text-slate-500 hover:underline">Quitar todo</button>
        </div>
      </div>
      <div className="space-y-3">
        {groups.map(g => (
          <div key={g.label}>
            <p className="text-[11px] font-medium text-slate-400 mb-1">{g.label}</p>
            <div className="space-y-1">
              {g.keys.map(key => byKey.get(key)).filter(Boolean).map(s => {
                const mode = value[s!.key]
                const disabled = ADMIN_ONLY.has(s!.key) && !isAdmin
                return (
                  <div key={s!.key} className={cn('flex items-center gap-2 px-1 py-0.5 rounded-lg', disabled && 'opacity-40')}>
                    <span className="flex-1 text-xs font-medium text-slate-700 truncate">{s!.label}</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0" role="radiogroup" aria-label={`Acceso a ${s!.label}`}>
                      <button type="button" role="radio" aria-checked={!mode} disabled={disabled} onClick={() => onChange(s!.key, null)}
                        className={cn('px-2 py-1 text-[11px] font-semibold transition-colors', !mode ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                        Sin acceso
                      </button>
                      <button type="button" role="radio" aria-checked={mode === 'read'} disabled={disabled} onClick={() => onChange(s!.key, 'read')}
                        className={cn('px-2 py-1 text-[11px] font-semibold border-l border-slate-200 flex items-center gap-1 transition-colors', mode === 'read' ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                        <Eye className="w-3 h-3" /> Lectura
                      </button>
                      <button type="button" role="radio" aria-checked={mode === 'full'} disabled={disabled} onClick={() => onChange(s!.key, 'full')}
                        className={cn('px-2 py-1 text-[11px] font-semibold border-l border-slate-200 flex items-center gap-1 transition-colors', mode === 'full' ? 'bg-accent-100 text-accent-700' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                        <Pencil className="w-3 h-3" /> Completo
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        Lectura = ve sin editar · Completo = ve y edita. Equipo, Actividad y Configuración requieren Administrador.
      </p>
    </fieldset>
  )
}
