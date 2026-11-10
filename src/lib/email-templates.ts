// Saludos y despedidas que se precargan al escribir un correo desde la
// ficha del lead, para que nadie del equipo le escriba "en seco" a un
// cliente. `{n}` es el nombre de pila del contacto; si no se conoce, queda
// NAME_PLACEHOLDER y el envío se bloquea hasta completarlo o quitarlo.

export const NAME_PLACEHOLDER = '[nombre]'

export type GreetingKey = 'cordial' | 'hora' | 'formal' | 'respuesta'
export type ClosingKey = 'disposicion' | 'gracias' | 'llamada' | 'atento'

function timeGreeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

export const GREETINGS: { key: GreetingKey; label: string; build: (n: string) => string }[] = [
  { key: 'cordial', label: 'Cordial', build: n => `Hola ${n}, ¿cómo estás? Espero que muy bien.` },
  { key: 'hora', label: 'Según la hora', build: n => `${timeGreeting()}, ${n}.` },
  { key: 'formal', label: 'Formal', build: n => `Estimado(a) ${n}:\nJunto con saludar,` },
  { key: 'respuesta', label: 'Respuesta', build: n => `Hola ${n}, muchas gracias por tu correo.` },
]

export const CLOSINGS: { key: ClosingKey; label: string; text: string }[] = [
  { key: 'disposicion', label: 'A disposición', text: 'Quedo a tu disposición ante cualquier duda.\n\nSaludos cordiales,' },
  { key: 'gracias', label: 'Agradecer', text: 'Muchas gracias por tu tiempo.\n\nSaludos,' },
  { key: 'llamada', label: 'Proponer llamada', text: '¿Te parece si lo conversamos en una llamada breve esta semana?\n\nSaludos,' },
  { key: 'atento', label: 'Esperando respuesta', text: 'Quedo atento(a) a tus comentarios.\n\nSaludos,' },
]

/** Nombre de pila para el saludo: la primera palabra del nombre completo. */
export function firstName(fullName?: string | null) {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first || first.includes('@')) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function greetingText(key: GreetingKey, name: string) {
  const g = GREETINGS.find(x => x.key === key) ?? GREETINGS[0]
  return g.build(name || NAME_PLACEHOLDER)
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
