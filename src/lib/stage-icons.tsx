// Iconos de etapa.
//
// Vive aparte de stages.ts porque los iconos son componentes React y no
// pueden guardarse en la base. Se derivan del token de color, que ya es
// semántico en la práctica: rojo = perdido, gris = descartado, etc.
//
// Esto reproduce exactamente los iconos que había hardcodeados por clave
// de etapa en kanban-board.tsx y deal-stage-selector.tsx, pero funciona
// también para etapas nuevas que cree cualquier organización.

import { XCircle, MinusCircle, PauseCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Stage, StageColor } from '@/lib/stages'

type IconComponent = React.ComponentType<{ className?: string }>

const BY_COLOR: Partial<Record<StageColor, IconComponent>> = {
  red: XCircle,        // "Perdido"
  rose: XCircle,
  gray: MinusCircle,   // "No calificado"
  slate: PauseCircle,  // "Frío"
  green: CheckCircle2, // "Ganado"
  emerald: CheckCircle2,
}

export function stageIcon(stage: Stage | null | undefined): IconComponent {
  if (!stage) return AlertTriangle
  if (stage.isWon) return CheckCircle2
  return BY_COLOR[stage.color] ?? AlertTriangle
}
