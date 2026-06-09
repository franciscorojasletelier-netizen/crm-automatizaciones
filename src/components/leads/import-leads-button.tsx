'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download } from 'lucide-react'

// ── Parser CSV simple (soporta comillas y separador , o ;) ────
function parseCSV(text: string): string[][] {
  const sep = text.split('\n')[0].includes(';') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cell += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === sep) { row.push(cell.trim()); cell = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(cell.trim()); cell = ''
        if (row.some(c => c !== '')) rows.push(row)
        row = []
      } else cell += ch
    }
  }
  if (cell.trim() !== '' || row.length > 0) { row.push(cell.trim()); if (row.some(c => c !== '')) rows.push(row) }
  return rows
}

// Detecta a qué campo corresponde cada encabezado del CSV
function mapHeader(h: string): string | null {
  const n = h.toLowerCase().trim()
  if (/empresa|company|compañia/.test(n))            return 'company'
  if (/industria|industry|rubro|sector/.test(n))     return 'industry'
  if (/contacto|nombre|name/.test(n))                return 'contact'
  if (/mail|correo/.test(n))                         return 'email'
  if (/fono|phone|tel|celular|movil/.test(n))        return 'phone'
  if (/cargo|puesto|job|title/.test(n))              return 'job'
  if (/fuente|source|origen/.test(n))                return 'source'
  if (/valor|value|monto|presupuesto|budget/.test(n)) return 'value'
  if (/web|sitio|url/.test(n))                       return 'website'
  return null
}

type ParsedLead = {
  company: string; contact: string; email: string; phone: string
  industry: string; job: string; source: string; value: string; website: string
}

export default function ImportLeadsButton() {
  const [open, setOpen]         = useState(false)
  const [leads, setLeads]       = useState<ParsedLead[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<{ ok: number; dup: number; fail: number } | null>(null)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()

  function handleFile(file: File) {
    setError(''); setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCSV(String(reader.result ?? ''))
      if (rows.length < 2) { setError('El archivo debe tener encabezados y al menos una fila de datos'); return }

      const headerMap = rows[0].map(mapHeader)
      if (!headerMap.includes('company') && !headerMap.includes('contact')) {
        setError('No se encontró columna de Empresa ni de Contacto. Encabezados detectados: ' + rows[0].join(', '))
        return
      }

      const parsed: ParsedLead[] = rows.slice(1).map(r => {
        const lead: any = { company: '', contact: '', email: '', phone: '', industry: '', job: '', source: '', value: '', website: '' }
        headerMap.forEach((field, i) => { if (field && r[i]) lead[field] = r[i] })
        return lead
      }).filter(l => l.company || l.contact)

      if (parsed.length === 0) { setError('No se encontraron filas válidas'); return }
      setLeads(parsed)
      setFileName(file.name)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function runImport() {
    setImporting(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let ok = 0, dup = 0, fail = 0

    for (const lead of leads) {
      try {
        // Dedup por email
        if (lead.email) {
          const { data: existing } = await supabase
            .from('contacts').select('id').ilike('email', lead.email).limit(1).maybeSingle()
          if (existing) { dup++; continue }
        }

        // Empresa (reutilizar si existe por nombre)
        let companyId: string
        const { data: existCo } = lead.company
          ? await supabase.from('companies').select('id').ilike('name', lead.company).limit(1).maybeSingle()
          : { data: null }
        if (existCo) companyId = existCo.id
        else {
          const { data: newCo, error: e1 } = await supabase.from('companies')
            .insert({ name: lead.company || lead.contact, industry: lead.industry || null, website: lead.website || null })
            .select('id').single()
          if (e1) throw e1
          companyId = newCo.id
        }

        const { data: newContact, error: e2 } = await supabase.from('contacts')
          .insert({
            company_id: companyId,
            full_name: lead.contact || lead.company,
            email: lead.email || null, phone: lead.phone || null, job_title: lead.job || null,
          }).select('id').single()
        if (e2) throw e2

        const { error: e3 } = await supabase.from('deals').insert({
          company_id: companyId,
          primary_contact_id: newContact.id,
          owner_id: user?.id ?? null,
          source: lead.source || 'Importación CSV',
          estimated_value: lead.value ? parseFloat(lead.value.replace(/[^0-9.]/g, '')) || null : null,
          next_action: 'Contactar lead importado',
          score: 0, stage: 'nuevo_lead', status: 'open',
        })
        if (e3) throw e3
        ok++
      } catch {
        fail++
      }
    }

    setResult({ ok, dup, fail })
    setImporting(false)
    router.refresh()
  }

  function reset() {
    setLeads([]); setFileName(''); setResult(null); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadTemplate() {
    const tpl = 'Empresa,Contacto,Email,Telefono,Industria,Cargo,Fuente,Valor estimado\n' +
                'Acme SpA,Juan Pérez,juan@acme.cl,+56912345678,Tecnología,Gerente TI,LinkedIn,5000000\n'
    const blob = new Blob(['﻿' + tpl], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'plantilla-leads.csv'
    a.click()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 shadow-sm hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md transition-all"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Importar CSV</span>
        <span className="sm:hidden">CSV</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !importing && setOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Importar leads desde CSV</h2>
                  <p className="text-xs text-slate-400">Acepta separador coma o punto y coma</p>
                </div>
              </div>
              {!importing && (
                <button onClick={() => { setOpen(false); reset() }} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Resultado final */}
              {result ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-lg font-bold text-slate-900">{result.ok} leads importados</p>
                    <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                      {result.dup > 0 && <span className="text-amber-600 font-semibold">{result.dup} duplicados omitidos</span>}
                      {result.fail > 0 && <span className="text-red-500 font-semibold">{result.fail} con error</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); reset() }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    Listo
                  </button>
                </div>
              ) : leads.length === 0 ? (
                <>
                  {/* Zona de carga */}
                  <label className="block border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                    <input
                      ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                    <Upload className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Haz clic para elegir un archivo CSV</p>
                    <p className="text-xs text-slate-400 mt-1">Columnas: Empresa, Contacto, Email, Teléfono, Industria, Fuente, Valor</p>
                  </label>

                  <button onClick={downloadTemplate}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors mx-auto">
                    <Download className="w-3.5 h-3.5" /> Descargar plantilla de ejemplo
                  </button>

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-bold text-slate-800">{fileName}</span>
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                        {leads.length} lead{leads.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    {!importing && (
                      <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors">
                        Cambiar archivo
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold text-slate-500">Empresa</th>
                          <th className="text-left px-3 py-2 font-bold text-slate-500">Contacto</th>
                          <th className="text-left px-3 py-2 font-bold text-slate-500">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leads.slice(0, 8).map((l, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-semibold text-slate-700 truncate max-w-[140px]">{l.company || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600 truncate max-w-[120px]">{l.contact || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-400 truncate max-w-[150px]">{l.email || '—'}</td>
                          </tr>
                        ))}
                        {leads.length > 8 && (
                          <tr><td colSpan={3} className="px-3 py-1.5 text-center text-slate-400">… y {leads.length - 8} más</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Los contactos con email ya registrado se omiten automáticamente. Los leads se te asignarán a ti.
                  </p>

                  <button
                    onClick={runImport} disabled={importing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando {leads.length} leads...</>
                      : <><Upload className="w-4 h-4" /> Importar {leads.length} lead{leads.length > 1 ? 's' : ''}</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
