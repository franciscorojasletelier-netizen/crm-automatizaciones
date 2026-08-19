import { GitBranch, MessageSquare, CheckSquare, MessagesSquare, Mail } from 'lucide-react'
import { stageLabel } from '@/lib/stages'
import type { Stage } from '@/lib/stages'

interface TimelineEvent {
  id: string
  type: 'stage' | 'interaction' | 'task' | 'message' | 'email'
  date: string
  content: string
  authorName: string | null
}

export default function DealTimeline({
  stages, history, interactions, tasks, chatMessages, emails,
}: {
  stages: Stage[]
  history: any[]
  interactions: any[]
  tasks: any[]
  chatMessages: any[]
  emails?: any[]
}) {
  // Un solo feed cronológico en vez de 4 bloques separados — lo primero
  // que se evalúa en una demo de CRM es "¿veo todo lo que pasó de un vistazo?".
  const events: TimelineEvent[] = [
    ...(history ?? []).map((h: any) => ({
      id: `stage-${h.id}`,
      type: 'stage' as const,
      date: h.changed_at,
      content: `${stageLabel(stages, h.from_stage)} → ${stageLabel(stages, h.to_stage)}`,
      authorName: h.profiles?.full_name ?? null,
    })),
    ...(interactions ?? []).map((i: any) => ({
      id: `interaction-${i.id}`,
      type: 'interaction' as const,
      date: i.created_at,
      // El alta (deal-interactions.tsx) inserta en `content`, no en
      // `notes` — con `i.notes` acá el texto nunca se mostraba,
      // siempre caía al nombre del tipo.
      content: i.content ?? i.type ?? 'Interacción registrada',
      authorName: i.profiles?.full_name ?? null,
    })),
    ...(tasks ?? []).map((t: any) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      date: t.created_at ?? t.due_date,
      content: t.is_completed ? `Tarea completada: ${t.title}` : `Tarea creada: ${t.title}`,
      authorName: t.profiles?.full_name ?? null,
    })),
    ...(chatMessages ?? []).map((m: any) => ({
      id: `message-${m.id}`,
      type: 'message' as const,
      date: m.created_at,
      content: m.content,
      authorName: m.profiles?.full_name ?? m.profiles?.email ?? null,
    })),
    ...(emails ?? []).map((e: any) => ({
      id: `email-${e.id}`,
      type: 'email' as const,
      date: e.sent_at,
      content: `${e.direction === 'outbound' ? 'Enviado' : 'Recibido'}: ${e.subject ?? '(sin asunto)'}`,
      authorName: e.from_address ?? null,
    })),
  ]
    .filter(e => e.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actividad</h2>
        <p className="text-xs text-slate-400">Todavía no hay actividad registrada en este deal.</p>
      </div>
    )
  }

  const ICONS: Record<TimelineEvent['type'], { icon: typeof GitBranch; color: string }> = {
    stage:       { icon: GitBranch,       color: 'text-indigo-500 bg-indigo-50' },
    interaction: { icon: MessageSquare,   color: 'text-amber-500 bg-amber-50' },
    task:        { icon: CheckSquare,     color: 'text-emerald-500 bg-emerald-50' },
    message:     { icon: MessagesSquare,  color: 'text-purple-500 bg-purple-50' },
    email:       { icon: Mail,            color: 'text-sky-500 bg-sky-50' },
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Actividad</h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {events.map(e => {
          const { icon: Icon, color } = ICONS[e.type]
          return (
            <div key={e.id} className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 leading-tight break-words">{e.content}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(e.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {e.authorName && ` · ${e.authorName}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
