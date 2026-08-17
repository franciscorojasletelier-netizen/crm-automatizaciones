// ============================================================
//  Fuente ÚNICA de verdad para las etapas del pipeline.
//
//  Las etapas ya no son constantes: cada organización define las
//  suyas en la tabla `pipeline_stages`. Este módulo es el único
//  lugar del repo que sabe cómo interpretarlas.
//
//  REGLA: si algo puede ser configuración de la organización, no se
//  vuelve a hardcodear en un componente. Si te encontrás por
//  escribir `const STAGES = [...]` en otro archivo, va acá.
// ============================================================

export type StageColor =
  | 'blue' | 'yellow' | 'purple' | 'indigo' | 'cyan'
  | 'orange' | 'pink' | 'green' | 'red' | 'gray'
  | 'slate' | 'emerald' | 'amber' | 'teal' | 'rose'

export interface Stage {
  id: string
  key: string
  label: string
  color: StageColor
  sortOrder: number
  isTerminal: boolean
  isWon: boolean
  isLost: boolean
  isDefault: boolean
  inFunnel: boolean
  requiresReason: boolean
  requiresAttachment: boolean
  createsProject: boolean
  defaultProbability: number
  reasons: string[]
  modalTitle: string | null
  modalSubtitle: string | null
  confirmLabel: string | null
  isActive: boolean
  pipelineId: string
}

export interface Pipeline {
  id: string
  name: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
}

// ── Paleta ────────────────────────────────────────────────────
// Tailwind purga en build: `bg-${color}-500` armado desde la base de
// datos NO genera CSS. Por eso las clases están escritas literalmente
// acá y la base solo guarda el token. Agregar un color nuevo implica
// agregarlo a este mapa Y a la lista de la migración 015.
// `hex` es para gráficos SVG, que sí aceptan valores dinámicos.
export const STAGE_COLORS: Record<StageColor, {
  dot: string; chip: string; light: string; text: string; ring: string; solid: string; hex: string
}> = {
  blue:    { dot: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',          light: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-300',    solid: 'bg-blue-500',    hex: '#3b82f6' },
  yellow:  { dot: 'bg-yellow-500',  chip: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',    light: 'bg-yellow-50',  text: 'text-yellow-700',  ring: 'ring-yellow-300',  solid: 'bg-yellow-500',  hex: '#eab308' },
  purple:  { dot: 'bg-purple-500',  chip: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',    light: 'bg-purple-50',  text: 'text-purple-700',  ring: 'ring-purple-300',  solid: 'bg-purple-500',  hex: '#a855f7' },
  indigo:  { dot: 'bg-indigo-500',  chip: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',    light: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-300',  solid: 'bg-indigo-500',  hex: '#6366f1' },
  cyan:    { dot: 'bg-cyan-500',    chip: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200',          light: 'bg-cyan-50',    text: 'text-cyan-700',    ring: 'ring-cyan-300',    solid: 'bg-cyan-500',    hex: '#06b6d4' },
  orange:  { dot: 'bg-orange-500',  chip: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',    light: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-300',  solid: 'bg-orange-500',  hex: '#f97316' },
  pink:    { dot: 'bg-pink-500',    chip: 'bg-pink-100 text-pink-700 ring-1 ring-pink-200',          light: 'bg-pink-50',    text: 'text-pink-700',    ring: 'ring-pink-300',    solid: 'bg-pink-500',    hex: '#ec4899' },
  green:   { dot: 'bg-green-500',   chip: 'bg-green-100 text-green-700 ring-1 ring-green-200',       light: 'bg-green-50',   text: 'text-green-700',   ring: 'ring-green-300',   solid: 'bg-green-500',   hex: '#22c55e' },
  red:     { dot: 'bg-red-500',     chip: 'bg-red-100 text-red-700 ring-1 ring-red-200',             light: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-300',     solid: 'bg-red-500',     hex: '#ef4444' },
  gray:    { dot: 'bg-gray-400',    chip: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',          light: 'bg-gray-50',    text: 'text-gray-700',    ring: 'ring-gray-300',    solid: 'bg-gray-400',    hex: '#9ca3af' },
  slate:   { dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',       light: 'bg-slate-100',  text: 'text-slate-600',   ring: 'ring-slate-300',   solid: 'bg-slate-400',   hex: '#94a3b8' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', light: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300', solid: 'bg-emerald-500', hex: '#10b981' },
  amber:   { dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',       light: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-300',   solid: 'bg-amber-500',   hex: '#f59e0b' },
  teal:    { dot: 'bg-teal-500',    chip: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',          light: 'bg-teal-50',    text: 'text-teal-700',    ring: 'ring-teal-300',    solid: 'bg-teal-500',    hex: '#14b8a6' },
  rose:    { dot: 'bg-rose-500',    chip: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',          light: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-300',    solid: 'bg-rose-500',    hex: '#f43f5e' },
}

export const STAGE_COLOR_TOKENS = Object.keys(STAGE_COLORS) as StageColor[]

// Para una etapa cuyo color no está en la paleta (dato viejo o mal
// cargado): se degrada a slate en vez de romper el render.
export function colorOf(stage: Pick<Stage, 'color'> | null | undefined) {
  return STAGE_COLORS[stage?.color as StageColor] ?? STAGE_COLORS.slate
}

// ── Carga ─────────────────────────────────────────────────────

const SELECT = `
  id, key, label, color, sort_order,
  is_terminal, is_won, is_lost, is_default, in_funnel,
  requires_reason, requires_attachment, creates_project,
  default_probability, reasons, modal_title, modal_subtitle, confirm_label,
  is_active, pipeline_id
`

function toStage(r: any): Stage {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    color: r.color,
    sortOrder: r.sort_order,
    isTerminal: r.is_terminal,
    isWon: r.is_won,
    isLost: r.is_lost,
    isDefault: r.is_default,
    inFunnel: r.in_funnel,
    requiresReason: r.requires_reason,
    requiresAttachment: r.requires_attachment,
    createsProject: r.creates_project,
    defaultProbability: r.default_probability,
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
    modalTitle: r.modal_title,
    modalSubtitle: r.modal_subtitle,
    confirmLabel: r.confirm_label,
    isActive: r.is_active,
    pipelineId: r.pipeline_id,
  }
}

function toPipeline(r: any): Pipeline {
  return { id: r.id, name: r.name, sortOrder: r.sort_order, isDefault: r.is_default, isActive: r.is_active }
}

// Los pipelines de una organización — para la mayoría de las pantallas
// (dashboard, reportes, tabla de leads, búsqueda) esto NO hace falta:
// solo lo necesitan el kanban, la creación de leads y el panel de
// plataforma, que sí tienen que saber "en qué pipeline estoy parado".
export async function getPipelines(supabase: any, orgId?: string): Promise<Pipeline[]> {
  let q = supabase.from('pipelines').select('id, name, sort_order, is_default, is_active').eq('is_active', true)
  if (orgId) q = q.eq('organization_id', orgId)
  const { data } = await q.order('sort_order', { ascending: true })
  return (data ?? []).map(toPipeline)
}

export function defaultPipeline(pipelines: Pipeline[]): Pipeline | null {
  return pipelines.find(p => p.isDefault) ?? pipelines[0] ?? null
}

// RLS acota a la organización del usuario para un cliente normal. Un
// platform_owner en cambio ve TODAS las organizaciones sin ese filtro (su
// policy es "organization_id = current_org_id() OR is_platform_owner()"),
// así que orgId es obligatorio pasarlo explícitamente al mirar una
// organización ajena (panel de plataforma) — sin él, un platform_owner
// vería el embudo de todos los clientes mezclado.
//
// Devuelve solo las activas — las inactivas siguen existiendo para que el
// historial y los reportes puedan resolver su label (ver stageByKey).
// `pipelineId` es opcional: la mayoría de las pantallas resuelven
// etapas por `key` sin importarles de qué pipeline son (las claves son
// únicas por organización, no por pipeline — ver migración 031). Solo
// pasalo cuando de verdad importa "las etapas DE ESTE pipeline"
// (kanban, editor de plataforma).
export async function getStages(supabase: any, orgId?: string, pipelineId?: string): Promise<Stage[]> {
  let q = supabase.from('pipeline_stages').select(SELECT).eq('is_active', true)
  if (orgId) q = q.eq('organization_id', orgId)
  if (pipelineId) q = q.eq('pipeline_id', pipelineId)
  const { data } = await q.order('sort_order', { ascending: true })
  return (data ?? []).map(toStage)
}

// Incluye las desactivadas. Se usa donde hay que mostrar datos
// históricos (detalle de un deal, reportes) y en el panel de configuración.
export async function getAllStages(supabase: any, orgId?: string, pipelineId?: string): Promise<Stage[]> {
  let q = supabase.from('pipeline_stages').select(SELECT)
  if (orgId) q = q.eq('organization_id', orgId)
  if (pipelineId) q = q.eq('pipeline_id', pipelineId)
  const { data } = await q.order('sort_order', { ascending: true })
  return (data ?? []).map(toStage)
}

// ── Selectores ────────────────────────────────────────────────

// Nunca lanza. Antes esto era `ALL_STAGES.find(...)!` y crasheaba la
// página entera si aparecía una etapa desconocida.
export function stageByKey(stages: Stage[], key: string | null | undefined): Stage | null {
  if (!key) return null
  return stages.find(s => s.key === key) ?? null
}

// Label seguro: si la etapa ya no existe, muestra la clave cruda en vez
// de "undefined".
export function stageLabel(stages: Stage[], key: string | null | undefined): string {
  return stageByKey(stages, key)?.label ?? key ?? '—'
}

export function defaultStage(stages: Stage[]): Stage | null {
  return stages.find(s => s.isDefault) ?? stages[0] ?? null
}

/** Columnas del kanban: las no terminales, en orden. */
export function boardStages(stages: Stage[]): Stage[] {
  return stages.filter(s => !s.isTerminal)
}

/** Bandeja de cierre del kanban. */
export function terminalStages(stages: Stage[]): Stage[] {
  return stages.filter(s => s.isTerminal)
}

/** Etapas del gráfico de embudo, en orden. */
export function funnelStages(stages: Stage[]): Stage[] {
  return stages.filter(s => s.inFunnel)
}

/**
 * `deals.status` que corresponde a una etapa.
 *
 * Unifica las dos versiones que había: el kanban reseteaba a 'open' al
 * volver a una etapa activa y el selector de etapa no, así que un deal
 * podía quedar con status='lost' estando en "Negociación". Gana la del
 * kanban, que es la correcta.
 */
export function statusForStage(stage: Stage | null): 'won' | 'lost' | 'open' {
  if (!stage) return 'open'
  if (stage.isWon) return 'won'
  if (stage.isLost) return 'lost'
  return 'open'
}

/** Probabilidad para el forecast ponderado. */
export function probabilityForStage(stages: Stage[], key: string, explicit?: number | null): number {
  if (explicit && explicit > 0) return explicit
  return stageByKey(stages, key)?.defaultProbability ?? 0
}
