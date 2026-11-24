import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { getCurrentProfile } from '@/lib/supabase/server'
import { getPermissions, canEditSection } from '@/lib/roles'
import { userRateLimit } from '@/lib/rate-limit'
import { friendlyError } from '@/lib/pg-error'
import {
  IMPORT_COLUMNS, IMPORT_MAX_ROWS, EMAIL_RE, mapHeader, parseAmount,
  type ImportedLead, type LeadField,
} from '@/lib/leads-import-format'

// Importación de leads desde Excel o CSV.
//   GET  → plantilla .xlsx con las columnas y una hoja de instrucciones.
//   POST → (multipart: file, dryRun) lee el archivo; con dryRun=1 solo
//          valida y devuelve la vista previa, sin escribir nada.
// Las escrituras van con el cliente de sesión: la RLS asigna la organización
// y acota la búsqueda de duplicados a lo que el usuario puede ver.

const MAX_BYTES = 5 * 1024 * 1024
const likeExact = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

async function authorize() {
  const ctx = await getCurrentProfile()
  const perms = getPermissions(ctx.role)
  const allowed = perms.canCreateLeads && canEditSection(ctx.role, ctx.sectionAccess, 'leads', ctx.disabledModules)
  return { ctx, allowed }
}

export async function GET() {
  const { allowed } = await authorize()
  if (!allowed) return NextResponse.json({ error: 'Sin permiso para importar leads' }, { status: 403 })

  const head = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } } }
  const leads = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS.map(c => c.header), IMPORT_COLUMNS.map(c => c.example)])
  const example = { font: { italic: true, color: { rgb: '64748B' } } }
  IMPORT_COLUMNS.forEach((c, i) => {
    leads[XLSX.utils.encode_cell({ r: 0, c: i })].s = head
    leads[XLSX.utils.encode_cell({ r: 1, c: i })].s = example
    // Teléfono como texto: si no, Excel borra el "+" y los espacios.
    if (c.field === 'phone') {
      for (let r = 2; r <= IMPORT_MAX_ROWS; r++) leads[XLSX.utils.encode_cell({ r, c: i })] = { t: 's', v: '', z: '@', s: { numFmt: '@' } }
    }
  })
  leads['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: IMPORT_MAX_ROWS, c: IMPORT_COLUMNS.length - 1 } })
  leads['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: IMPORT_COLUMNS.length - 1 } }) }
  leads['!cols'] = IMPORT_COLUMNS.map(c => ({ wch: Math.max(c.header.length, c.example.length) + 4 }))

  const guide = XLSX.utils.aoa_to_sheet([
    ['Cómo llenar la hoja "Leads"'],
    [],
    ['Columna', 'Para qué sirve'],
    ...IMPORT_COLUMNS.map(c => [c.header, c.help || 'Opcional.']),
    [],
    ['Reglas generales'],
    ['• Una fila por lead. Borra la fila de ejemplo antes de importar.'],
    ['• Cada fila necesita al menos Empresa o Contacto.'],
    ['• No cambies los encabezados de la primera fila; el orden de las columnas da igual.'],
    [`• Hasta ${IMPORT_MAX_ROWS} filas por archivo. También se acepta CSV con coma o punto y coma.`],
    ['• Los leads importados quedan asignados a quien los importa, en la primera etapa del pipeline.'],
  ])
  guide.A1.s = { font: { bold: true, sz: 13 } }
  guide.A3.s = guide.B3.s = head
  guide['!cols'] = [{ wch: 18 }, { wch: 70 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, leads, 'Leads')
  XLSX.utils.book_append_sheet(wb, guide, 'Instrucciones')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-importacion-leads.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}

type RowIssue = { row: number; message: string }

// Un CSV puede venir en UTF-8 o, si se guardó desde Excel en Windows, en
// Windows-1252: se prueba UTF-8 estricto y si falla se lee como 1252.
function decodeText(buf: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '') }
  catch { return new TextDecoder('windows-1252').decode(buf) }
}

/** Lee la primera hoja del archivo y la convierte en leads validados. */
function readFile(buf: Buffer, name: string) {
  const isCsv = /\.(csv|txt)$/i.test(name)
  const wb = isCsv
    ? XLSX.read(decodeText(buf), { type: 'string', raw: true })
    : XLSX.read(buf, { type: 'buffer', raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { error: 'El archivo no tiene hojas' }
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, raw: true, defval: '', blankrows: true })
  if (grid.length < 2) return { error: 'El archivo debe tener la fila de encabezados y al menos una fila de datos' }

  const fields = grid[0].map(h => mapHeader(String(h)))
  if (!fields.includes('company') && !fields.includes('contact')) {
    return { error: `No se encontró la columna Empresa ni Contacto. Encabezados del archivo: ${grid[0].join(', ')}` }
  }
  const body = grid.slice(1)
  // Las filas vacías se conservan para que el número de fila calce con Excel;
  // las del final no cuentan para el máximo.
  while (body.length && body[body.length - 1].every(c => String(c).trim() === '')) body.pop()
  if (body.length > IMPORT_MAX_ROWS) return { error: `El archivo tiene ${body.length} filas; el máximo es ${IMPORT_MAX_ROWS}` }

  const valid: { row: number; lead: ImportedLead; value: number | null }[] = []
  const invalid: RowIssue[] = []
  body.forEach((cells, i) => {
    const row = i + 2 // número de fila tal como se ve en Excel
    const lead = { company: '', contact: '', email: '', phone: '', job: '', industry: '', website: '', source: '', value: '' } as ImportedLead
    let rawValue: string | number = ''
    fields.forEach((f: LeadField | null, c) => {
      if (!f) return
      const v = cells[c] ?? ''
      if (f === 'value') rawValue = v
      lead[f] = String(v).trim().slice(0, 300)
    })
    if (Object.values(lead).every(v => !v)) return
    if (!lead.company && !lead.contact) return invalid.push({ row, message: 'Falta Empresa o Contacto' })
    if (lead.email && !EMAIL_RE.test(lead.email)) return invalid.push({ row, message: `Email no válido: ${lead.email}` })
    const value = parseAmount(rawValue)
    if (Number.isNaN(value)) return invalid.push({ row, message: `Valor estimado no se entiende: ${lead.value}` })
    valid.push({ row, lead, value })
  })
  return { valid, invalid }
}

export async function POST(request: NextRequest) {
  const { ctx, allowed } = await authorize()
  if (!allowed) return NextResponse.json({ error: 'Sin permiso para importar leads' }, { status: 403 })
  const { user, supabase } = ctx

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo supera los 5 MB' }, { status: 400 })
  const dryRun = form?.get('dryRun') === '1'

  let parsed: ReturnType<typeof readFile>
  try {
    parsed = readFile(Buffer.from(await file.arrayBuffer()), file.name)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo. Usa la plantilla Excel o un CSV.' }, { status: 400 })
  }
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { valid, invalid } = parsed

  if (dryRun) {
    return NextResponse.json({
      total: valid.length,
      preview: valid.slice(0, 8).map(v => v.lead),
      invalid: invalid.slice(0, 20), invalidCount: invalid.length,
    })
  }

  const limited = await userRateLimit('import_leads', user.id, 10, 15)
  if (limited) return limited

  let ok = 0, dup = 0
  const failed: RowIssue[] = [...invalid]
  const seenEmails = new Set<string>()
  const companyIds = new Map<string, string>()

  for (const { row, lead, value } of valid) {
    try {
      const email = lead.email.toLowerCase()
      if (email) {
        if (seenEmails.has(email)) { dup++; continue }
        seenEmails.add(email)
        const { data: existing } = await supabase.from('contacts').select('id')
          .ilike('email', likeExact(email)).limit(1).maybeSingle()
        if (existing) { dup++; continue }
      }

      const companyName = lead.company || lead.contact
      const key = companyName.toLowerCase()
      let companyId = companyIds.get(key)
      if (!companyId) {
        const { data: found } = await supabase.from('companies').select('id')
          .ilike('name', likeExact(companyName)).limit(1).maybeSingle()
        if (found) companyId = found.id
        else {
          const { data: created, error } = await supabase.from('companies')
            .insert({ name: companyName, industry: lead.industry || null, website: lead.website || null })
            .select('id').single()
          if (error) throw error
          companyId = created.id
        }
        companyIds.set(key, companyId)
      }

      const { data: contact, error: contactErr } = await supabase.from('contacts').insert({
        company_id: companyId, full_name: lead.contact || lead.company,
        email: lead.email || null, phone: lead.phone || null, job_title: lead.job || null,
      }).select('id').single()
      if (contactErr) throw contactErr

      // Etapa y pipeline los asigna el trigger según la organización.
      const { error: dealErr } = await supabase.from('deals').insert({
        company_id: companyId, primary_contact_id: contact.id, owner_id: user.id,
        source: lead.source || 'Importación', estimated_value: value,
        next_action: 'Contactar lead importado', score: 0, status: 'open',
      })
      if (dealErr) throw dealErr
      ok++
    } catch (err) {
      failed.push({ row, message: friendlyError((err as { message?: string })?.message) })
    }
  }

  failed.sort((a, b) => a.row - b.row)
  return NextResponse.json({ ok, dup, failCount: failed.length, failed: failed.slice(0, 20) })
}
