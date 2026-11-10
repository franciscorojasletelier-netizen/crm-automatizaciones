// Saludos, despedidas y plantillas por situación que se precargan al
// escribir un correo desde la ficha del lead, para que nadie del equipo le
// escriba "en seco" a un cliente.
//
// Marcadores:
//  - En saludos y plantillas, {nombre} {empresa} {miempresa} {vendedor} se
//    reemplazan al insertarlos con los datos del lead.
//  - Lo que va entre corchetes, como [nombre] o [paso 1], es un espacio
//    para completar a mano: el envío se bloquea mientras quede alguno.

export const NAME_PLACEHOLDER = '[nombre]'
/** Espacios para completar: [texto] de 2 a 60 caracteres en una línea. */
export const FILL_IN_RE = /\[[^\]\n]{2,60}\]/g

export type Treatment = 'sr' | 'sra' | null
export type GreetingKey = 'cordial' | 'hora' | 'formal' | 'respuesta'
export type ClosingKey = 'disposicion' | 'gracias' | 'llamada' | 'atento'

function timeGreeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

const estimado = (t: Treatment) => t === 'sr' ? 'Estimado' : t === 'sra' ? 'Estimada' : 'Estimado(a)'

export const GREETINGS: { key: GreetingKey; label: string; build: (n: string, t: Treatment) => string }[] = [
  { key: 'cordial', label: 'Cordial', build: n => `Hola ${n}, ¿cómo estás? Espero que muy bien.` },
  { key: 'hora', label: 'Según la hora', build: n => `${timeGreeting()}, ${n}.` },
  { key: 'formal', label: 'Formal', build: (n, t) => `${estimado(t)} ${n}:\nJunto con saludar,` },
  { key: 'respuesta', label: 'Respuesta', build: n => `Hola ${n}, muchas gracias por tu correo.` },
]

export const CLOSINGS: { key: ClosingKey; label: string; text: string }[] = [
  { key: 'disposicion', label: 'A disposición', text: 'Quedo a tu disposición ante cualquier duda.\n\nSaludos cordiales,' },
  { key: 'gracias', label: 'Agradecer', text: 'Muchas gracias por tu tiempo.\n\nSaludos,' },
  { key: 'llamada', label: 'Proponer llamada', text: '¿Te parece si lo conversamos en una llamada breve esta semana?\n\nSaludos,' },
  { key: 'atento', label: 'Esperando respuesta', text: 'Quedo atento(a) a tus comentarios.\n\nSaludos,' },
]

/** Plantilla por situación: llena el asunto y el cuerpo (entre saludo y despedida). */
export interface EmailTemplate { id: string; label: string; subject: string; body: string }

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'primer-contacto', label: 'Primer contacto',
    subject: '{miempresa} · Conversemos sobre {empresa}',
    body: 'Te escribo de parte de {miempresa}. Ayudamos a empresas como {empresa} a [beneficio principal].\n\nMe gustaría contarte en pocos minutos cómo podríamos ayudarles.',
  },
  {
    id: 'propuesta', label: 'Enviar propuesta',
    subject: 'Propuesta para {empresa}',
    body: 'Como lo conversamos, te comparto la propuesta para {empresa}.\n\nEn resumen: [alcance], con un plazo de [plazo] y una inversión de [valor].',
  },
  {
    id: 'seguimiento', label: 'Seguimiento',
    subject: 'Seguimiento: propuesta para {empresa}',
    body: 'Te escribo para saber si pudiste revisar [la propuesta / lo que conversamos].\n\nSi te sirve, puedo resolver cualquier duda en una llamada corta.',
  },
  {
    id: 'post-reunion', label: 'Después de reunión',
    subject: 'Gracias por la reunión',
    body: 'Gracias por tu tiempo en la reunión de hoy. Como acordamos, los próximos pasos son:\n\n- [paso 1]\n- [paso 2]',
  },
]

export const TEMPLATE_LIMITS = { count: 20, label: 40, subject: 150, body: 2000 }

/**
 * Valida y recorta lo guardado en email_templates (de la empresa o del
 * usuario). Sin datos: las por defecto para la empresa, ninguna para el usuario.
 */
export function normalizeTemplates(raw: unknown, fallback: EmailTemplate[] = DEFAULT_TEMPLATES): EmailTemplate[] {
  if (!Array.isArray(raw)) return fallback
  const list = raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t, i) => ({
      id: typeof t.id === 'string' && t.id ? t.id : `t${i}`,
      label: String(t.label ?? '').trim().slice(0, TEMPLATE_LIMITS.label),
      subject: String(t.subject ?? '').trim().slice(0, TEMPLATE_LIMITS.subject),
      body: String(t.body ?? '').trim().slice(0, TEMPLATE_LIMITS.body),
    }))
    .filter(t => t.label && t.body)
    .slice(0, TEMPLATE_LIMITS.count)
  return list
}

export interface TemplateVars { nombre?: string; empresa?: string; miempresa?: string; vendedor?: string }

/** Reemplaza {nombre} {empresa}… ; si falta el dato, deja un espacio para completar. */
export function fillVars(text: string, vars: TemplateVars) {
  return text.replace(/\{(nombre|empresa|miempresa|vendedor)\}/g, (_, k: keyof TemplateVars) => vars[k]?.trim() || `[${k}]`)
}

/**
 * Al guardar un correo como plantilla: vuelve a poner {nombre} y {empresa}
 * donde aparecen el nombre y la empresa del cliente, para reusarla con otros.
 */
export function tokenizeVars(text: string, vars: TemplateVars) {
  let out = text
  for (const key of ['empresa', 'nombre'] as const) {
    const value = vars[key]?.trim()
    if (value && value.length >= 3) out = out.split(value).join(`{${key}}`)
  }
  return out
}

/** Nombre de pila para el saludo: la primera palabra del nombre completo. */
export function firstName(fullName?: string | null) {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first || first.includes('@')) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function greetingText(key: GreetingKey, name: string, treatment: Treatment = null) {
  const g = GREETINGS.find(x => x.key === key) ?? GREETINGS[0]
  return g.build(name || NAME_PLACEHOLDER, treatment)
}

export function closingText(key: ClosingKey) {
  return (CLOSINGS.find(x => x.key === key) ?? CLOSINGS[0]).text
}

/** Arma el cuerpo: saludo, espacio para el mensaje y despedida. */
export function composeBody(greeting: string, middle: string, closing: string) {
  return `${greeting}\n\n${middle}\n\n${closing}`
}

/** Cursor justo después del saludo y la línea en blanco (donde se escribe). */
export function middleOffset(greeting: string) {
  return greeting.length + 2
}

/**
 * Lo que escribió el vendedor, sin el saludo ni la despedida (si siguen
 * tal cual al principio y al final). Sirve para no dejar enviar un correo
 * que solo tiene saludo y despedida.
 */
export function middleOf(body: string, greeting: string, closing: string) {
  let rest = body
  if (greeting && rest.startsWith(greeting)) rest = rest.slice(greeting.length)
  if (closing && rest.trimEnd().endsWith(closing)) rest = rest.trimEnd().slice(0, -closing.length)
  return rest.trim()
}

/** Cambia el texto entre el saludo y la despedida (o lo agrega al final si se editaron). */
export function replaceMiddle(body: string, greeting: string, closing: string, middle: string) {
  const trimmed = body.trimEnd()
  if (greeting && closing && body.startsWith(greeting) && trimmed.endsWith(closing)) {
    return composeBody(greeting, middle, closing)
  }
  return `${trimmed}\n\n${middle}`
}

/** Reemplaza el saludo (o la despedida) actual por otro, sin tocar lo escrito. */
export function swapPart(body: string, current: string, next: string, where: 'start' | 'end') {
  if (where === 'start') {
    if (current && body.startsWith(current)) return next + body.slice(current.length)
    return `${next}\n\n${body.trimStart()}`
  }
  const trimmed = body.trimEnd()
  if (current && trimmed.endsWith(current)) return trimmed.slice(0, -current.length) + next
  return `${trimmed}\n\n${next}`
}

/** Espacios para completar que siguen en el texto ([nombre], [paso 1]…). */
export function pendingFillIns(...texts: string[]) {
  return Array.from(new Set(texts.flatMap(t => t.match(FILL_IN_RE) ?? [])))
}
