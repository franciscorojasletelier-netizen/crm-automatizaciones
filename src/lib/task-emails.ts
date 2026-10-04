// Correos de tareas con la plantilla común: resumen diario por usuario,
// resumen diario de la organización y aviso minutos antes de una tarea.
import { CHILE_TZ } from '@/lib/dates'
import { emailButton, emailCallout, emailHeading, emailParagraph, emailRows, emailShell, EMAIL_COLORS, EMAIL_FONT, type EmailBrand } from '@/lib/email-layout'
import { escapeHtml } from '@/lib/html'

export interface TaskLine { title: string; due_date: string | null; company?: string | null }

const dayLong = (d = new Date()) => d.toLocaleDateString('es-CL', { timeZone: CHILE_TZ, weekday: 'long', day: 'numeric', month: 'long' })
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "8 oct · 10:00" o "8 oct" si la tarea es de todo el día (medianoche en Chile). */
export function taskWhen(due: string | null): string {
  if (!due) return ''
  const d = new Date(due)
  const day = d.toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('es-CL', { timeZone: CHILE_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  return time === '00:00' ? day : `${day} · ${time}`
}

const rows = (list: TaskLine[], danger = false) =>
  emailRows(list.map(t => ({ left: t.title, sub: t.company ?? null, right: taskWhen(t.due_date), tone: danger ? 'danger' as const : 'normal' as const })))

/** Resumen de la mañana para cada usuario: vencidas + hoy/mañana. */
export function renderDailyDigest({ userName, overdue, upcoming, appUrl, brand }: {
  userName: string; overdue: TaskLine[]; upcoming: TaskLine[]; appUrl: string; brand: EmailBrand
}) {
  const subject = overdue.length > 0
    ? `${overdue.length} ${overdue.length === 1 ? 'tarea vencida' : 'tareas vencidas'} y ${upcoming.length} para hoy — ${brand.name}`
    : `Tienes ${upcoming.length} ${upcoming.length === 1 ? 'tarea' : 'tareas'} para hoy y mañana — ${brand.name}`
  const content =
    `<div style="font:600 20px/1.35 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};margin:0 0 6px;">Buenos días, ${escapeHtml(userName)}</div>`
    + emailParagraph(`${capitalize(dayLong())}. Esto es lo que tienes pendiente:`)
    + (overdue.length ? emailHeading(`Vencidas (${overdue.length})`, EMAIL_COLORS.red) + rows(overdue, true) : '')
    + (upcoming.length ? emailHeading(`Hoy y mañana (${upcoming.length})`) + rows(upcoming) : emailCallout(emailParagraph('No tienes tareas para hoy ni mañana.')))
    + emailButton(`${appUrl}/tareas`, 'Ver mis tareas')
  const html = emailShell({
    subject, brand, content, bar: overdue.length ? EMAIL_COLORS.red : EMAIL_COLORS.accent,
    preheader: overdue.length ? `${overdue.length} vencidas · ${upcoming.length} para hoy y mañana` : `${upcoming.length} tareas para hoy y mañana`,
    kicker: `Resumen del día\n${dayLong()}`,
    footerNote: 'Resumen automático de cada mañana. Además, cada tarea con hora te avisa 5 minutos antes.',
  })
  return { subject, html }
}

/** Resumen de la organización (al correo de notificaciones de la empresa). */
export function renderOrgDigest({ today, overdue, appUrl, brand }: {
  today: TaskLine[]; overdue: TaskLine[]; appUrl: string; brand: EmailBrand
}) {
  const subject = `${today.length} ${today.length === 1 ? 'tarea' : 'tareas'} para hoy — ${brand.name}`
  const content =
    emailParagraph(`${capitalize(dayLong())}. Tareas del equipo:`)
    + (today.length ? emailHeading(`Para hoy (${today.length})`) + rows(today) : '')
    + (overdue.length ? emailHeading(`Vencidas (${overdue.length})`, EMAIL_COLORS.red) + rows(overdue, true) : '')
    + emailButton(`${appUrl}/tareas`, 'Ver tareas en el CRM')
  const html = emailShell({
    subject, brand, content, kicker: `Tareas del equipo\n${dayLong()}`,
    footerNote: 'Se envía cada mañana al correo de notificaciones de la empresa.',
  })
  return { subject, html }
}

/** Aviso minutos antes de una tarea con hora. */
export function renderTaskSoon({ firstName, minutes, task, description, link, brand }: {
  firstName: string; minutes: number; task: TaskLine; description?: string | null; link: string; brand: EmailBrand
}) {
  const time = new Date(task.due_date!).toLocaleTimeString('es-CL', { timeZone: CHILE_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  const subject = `⏰ ${time} · ${task.title}`
  const content =
    `<div style="font:600 20px/1.35 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};margin:0 0 14px;">${firstName ? `${escapeHtml(firstName)}, en` : 'En'} ${minutes} minutos tienes:</div>`
    + emailCallout(
      `<div style="font:700 26px/1.2 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};">${time}</div>
       <div style="font:600 16px/1.4 ${EMAIL_FONT};color:${EMAIL_COLORS.ink};margin-top:6px;">${escapeHtml(task.title)}</div>
       ${task.company ? `<div style="font:400 13px/1.4 ${EMAIL_FONT};color:${EMAIL_COLORS.muted};margin-top:2px;">${escapeHtml(task.company)}</div>` : ''}
       ${description ? `<div style="font:400 14px/1.5 ${EMAIL_FONT};color:${EMAIL_COLORS.text};margin-top:10px;">${escapeHtml(description.slice(0, 500)).replace(/\n/g, '<br>')}</div>` : ''}`)
    + emailButton(link, 'Abrir la tarea')
  const html = emailShell({
    subject, brand, content, bar: EMAIL_COLORS.amber,
    preheader: `${time} — ${task.title}`,
    kicker: 'Recordatorio',
    footerNote: `Aviso automático ${minutes} minutos antes de cada tarea con hora.`,
  })
  return { subject, html }
}
