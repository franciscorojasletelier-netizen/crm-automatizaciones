import type { SupabaseClient } from '@supabase/supabase-js'
import { CHILE_TZ } from '@/lib/dates'

const CONFLICT_WINDOW_MS = 30 * 60 * 1000  // 30 minutos

export interface ConflictTask {
  id:       string
  title:    string
  due_date: string
  company:  string | null
}

/**
 * Verifica si el usuario ya tiene una tarea dentro de ±30 min de la hora dada.
 * Excluye la tarea con `excludeTaskId` (para ediciones).
 */
export async function checkTaskConflict(
  supabase: SupabaseClient,
  userId:   string,
  dueDate:  string,
  excludeTaskId?: string
): Promise<ConflictTask[]> {
  const target   = new Date(dueDate).getTime()
  const from     = new Date(target - CONFLICT_WINDOW_MS).toISOString()
  const to       = new Date(target + CONFLICT_WINDOW_MS).toISOString()

  const { data } = await supabase
    .from('tasks')
    .select('id, title, due_date, deals(companies(name))')
    .eq('assigned_to', userId)
    .eq('is_completed', false)
    .gte('due_date', from)
    .lte('due_date', to)

  // deals(companies(name)) es a-uno; sin tipos de base se infiere como arreglo.
  type Row = { id: string; title: string; due_date: string; deals: { companies: { name: string | null } | null } | null }
  return ((data ?? []) as unknown as Row[])
    .filter(t => t.id !== excludeTaskId)
    .map(t => ({
      id:       t.id,
      title:    t.title,
      due_date: t.due_date,
      company:  t.deals?.companies?.name ?? null,
    }))
}

export function formatConflictTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { timeZone: CHILE_TZ, hour: '2-digit', minute: '2-digit' })
}
