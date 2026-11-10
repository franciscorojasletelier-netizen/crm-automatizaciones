// Zona horaria del CRM. El servidor (Vercel) corre en UTC y el navegador en
// la hora local del usuario: sin fijar la zona, "hoy" y las fechas mostradas
// cambian según dónde se renderice. Pasado las 20:00/21:00 en Chile, UTC ya
// está en el día siguiente.
export const CHILE_TZ = 'America/Santiago'

// Para columnas `date` (sin hora: expected_close_date, valid_until, fechas de
// proyectos). `new Date('2026-06-09')` es medianoche UTC; mostrarla en hora de
// Chile la corre al día anterior. Se formatean en UTC para que el día quede fijo.
export const DATE_ONLY_TZ = 'UTC'

// 'YYYY-MM-DD' del día calendario en Chile.
export function chileDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

// Diferencia (ms) entre la hora de Chile y UTC en ese instante: -3h o -4h según horario.
function chileOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

// Campos <input type="datetime-local"> ("2026-11-11T10:00", sin zona):
// el valor es la hora de Chile que eligió el usuario. Guardarlo tal cual en
// una columna timestamptz lo interpreta como UTC y la tarea queda 3-4 h
// corrida; y new Date(valor) depende de la zona del navegador.
export function chileLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value ?? '')
  if (!m) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
  const first = asUtc - chileOffsetMs(new Date(asUtc))
  // Segunda pasada por si el offset cambia justo en ese tramo (cambio de horario).
  return new Date(asUtc - chileOffsetMs(new Date(first))).toISOString()
}

// Inverso: instante guardado → valor para un datetime-local, en hora de Chile.
export function isoToChileLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

// Instante en que empieza el día de Chile ubicado `offsetDays` días después
// de hoy (0 = hoy, 1 = mañana, -1 = ayer). Sirve para filtrar columnas
// timestamptz por "día chileno".
export function chileDayStart(offsetDays = 0, now: Date = new Date()): Date {
  const [y, m, d] = chileDateString(now).split('-').map(Number)
  const midnightAsUtc = Date.UTC(y, m - 1, d + offsetDays)
  const target = chileDateString(new Date(midnightAsUtc + 12 * 3600_000))

  // Chile cambia de horario a las 00:00, así que ese día la medianoche puede
  // no existir (se salta a la 01:00). Se prueban los dos offsets posibles y se
  // queda con el primer instante que ya cae en el día buscado.
  const candidates = [
    midnightAsUtc - chileOffsetMs(new Date(midnightAsUtc)),
    midnightAsUtc - chileOffsetMs(new Date(midnightAsUtc - chileOffsetMs(new Date(midnightAsUtc)))),
  ].sort((a, b) => a - b)
  const start = candidates.find(t => chileDateString(new Date(t)) === target) ?? candidates[candidates.length - 1]
  return new Date(start)
}

// Instante en que empieza el mes de Chile ubicado `offsetMonths` meses
// después del actual (0 = este mes, -1 = el anterior, 1 = el próximo).
export function chileMonthStart(offsetMonths = 0, now: Date = new Date()): Date {
  const [y, m] = chileDateString(now).split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + offsetMonths, 1))
  const today = Date.UTC(y, m - 1, Number(chileDateString(now).slice(8, 10)))
  return chileDayStart(Math.round((first.getTime() - today) / 86_400_000), now)
}

// Vencimiento "en las próximas horas hábiles" (lun–vie, 9:00–18:00 de
// Chile): dentro del horario, 2 horas después; fuera de él, el siguiente
// día hábil a las 10:00.
export function nextBusinessDue(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: CHILE_TZ, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12) % 24
  const isWeekday = !['Sat', 'Sun'].includes(weekday)
  if (isWeekday && hour >= 9 && hour < 16) return new Date(now.getTime() + 2 * 3600_000)
  // Primer día hábil a partir de hoy (si aún no son las 9) o de mañana.
  for (let offset = isWeekday && hour < 9 ? 0 : 1; offset < 8; offset++) {
    const day = chileDayStart(offset, now)
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: CHILE_TZ, weekday: 'short' }).format(new Date(day.getTime() + 12 * 3600_000))
    if (!['Sat', 'Sun'].includes(wd)) return new Date(day.getTime() + 10 * 3600_000)
  }
  return new Date(now.getTime() + 2 * 3600_000)
}
