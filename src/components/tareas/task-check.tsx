'use client'

import { Circle, CheckCircle, AlertCircle } from 'lucide-react'

// Check de tarea sin estado propio: la tabla aplica el cambio al instante
// (optimista) y lo revierte si la base lo rechaza.
export default function TaskCheck({ isCompleted, isOverdue, readOnly, onToggle }: {
  isCompleted: boolean
  isOverdue: boolean
  readOnly?: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'} aria-pressed={isCompleted}
      onClick={onToggle} disabled={readOnly}
      className={`mt-0.5 shrink-0 transition-transform ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}>
      {isCompleted
        ? <CheckCircle className="w-4 h-4 text-green-500" />
        : isOverdue
          ? <AlertCircle className="w-4 h-4 text-red-500" />
          : <Circle className="w-4 h-4 text-gray-300 hover:text-gray-500" />
      }
    </button>
  )
}
