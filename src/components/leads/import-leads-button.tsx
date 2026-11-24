'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download } from 'lucide-react'
import { useDialog } from '@/lib/use-dialog'
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, type ImportedLead } from '@/lib/leads-import-format'

type RowIssue = { row: number; message: string }
type Preview = { total: number; preview: ImportedLead[]; invalid: RowIssue[]; invalidCount: number }
type Result = { ok: number; dup: number; failCount: number; failed: RowIssue[] }

const REQUIRED = new Set(['company', 'contact'])
const plural = (n: number, s = 's') => (n === 1 ? '' : s)

function IssueList({ title, items, total }: { title: string; items: RowIssue[]; total: number }) {
  if (total === 0) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
      <p className="font-semibold mb-1">{title}</p>
      <ul className="space-y-0.5 max-h-28 overflow-y-auto">
        {items.map(i => <li key={i.row}>Fila {i.row}: {i.message}</li>)}
        {total > items.length && <li>… y {total - items.length} más</li>}
      </ul>
    </div>
  )
}

// La lectura del archivo y las escrituras pasan por /api/leads/import: el
// servidor acepta Excel o CSV, valida cada fila y crea empresa, contacto y
// negocio con la sesión del usuario.
export default function ImportLeadsButton() {
  const [open, setOpen]       = useState(false)
  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy]       = useState<'' | 'reading' | 'importing'>('')
  const [result, setResult]   = useState<Result | null>(null)
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()
  const importing = busy === 'importing'
  const dialogRef = useDialog(open, () => setOpen(false), importing)

  async function send(f: File, dryRun: boolean) {
    const body = new FormData()
    body.append('file', f)
    if (dryRun) body.append('dryRun', '1')
    const res = await fetch('/api/leads/import', { method: 'POST', body })
    const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor' }))
    if (!res.ok) throw new Error(data.error ?? 'No se pudo procesar el archivo')
    return data
  }

  async function handleFile(f: File) {
    setError(''); setResult(null); setPreview(null); setBusy('reading')
    try {
      const data: Preview = await send(f, true)
      if (data.total === 0 && data.invalidCount === 0) throw new Error('No se encontraron filas con datos')
      setFile(f); setPreview(data)
    } catch (e) {
      setError((e as Error).message)
      if (fileRef.current) fileRef.current.value = ''
    } finally { setBusy('') }
  }

  async function runImport() {
    if (!file) return
    setError(''); setBusy('importing')
    try {
      setResult(await send(file, false))
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy('') }
  }

  function reset() {
    setFile(null); setPreview(null); setResult(null); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }
  function close() { setOpen(false); reset() }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 shadow-sm hover:border-accent-300 hover:text-accent-600 hover:shadow-md transition-all"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Importar leads</span>
        <span className="sm:hidden">Importar</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !importing && close()} />
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Importar leads" className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl border border-slate-200 outline-none">

            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-accent-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Importar leads</h2>
                  <p className="text-xs text-slate-500">Desde Excel (.xlsx) o CSV, hasta {IMPORT_MAX_ROWS} filas</p>
                </div>
              </div>
              {!importing && (
                <button onClick={close} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {result ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-lg font-bold text-slate-900">{result.ok} lead{plural(result.ok)} importado{plural(result.ok)}</p>
                    {result.dup > 0 && (
                      <p className="text-xs text-amber-700 font-semibold mt-1">
                        {result.dup} omitido{plural(result.dup)} porque el email ya existía
                      </p>
                    )}
                  </div>
                  <IssueList title={`${result.failCount} fila${plural(result.failCount)} sin importar`} items={result.failed} total={result.failCount} />
                  <button onClick={close} className="bg-accent-600 w-full py-2.5 rounded-lg text-sm font-semibold text-white">Listo</button>
                </div>
              ) : !preview ? (
                <>
                  {/* Paso 1: formato */}
                  <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">1. Descarga la plantilla y llénala</p>
                        <p className="text-xs text-slate-500 mt-0.5">Trae las columnas listas y una hoja con instrucciones.</p>
                      </div>
                      <a href="/api/leads/import" download
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Plantilla Excel
                      </a>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="font-semibold pb-1 pr-3">Columna</th>
                          <th className="font-semibold pb-1">Ejemplo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {IMPORT_COLUMNS.map(c => (
                          <tr key={c.field}>
                            <td className="py-1 pr-3 font-semibold text-slate-700 whitespace-nowrap">
                              {c.header}{REQUIRED.has(c.field) && <span className="text-red-500">*</span>}
                            </td>
                            <td className="py-1 text-slate-500">{c.example}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-slate-500">
                      <span className="text-red-500">*</span> Cada fila necesita Empresa o Contacto; el resto es opcional. El orden de las columnas da igual.
                    </p>
                  </div>

                  {/* Paso 2: subir */}
                  <label className={`block border-2 border-dashed border-slate-300 hover:border-accent-400 rounded-lg p-6 text-center transition-colors bg-slate-50/50 hover:bg-accent-50/30 ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                    <input
                      ref={fileRef} type="file" className="hidden"
                      accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                    {busy === 'reading'
                      ? <Loader2 className="w-7 h-7 text-accent-500 mx-auto mb-2 animate-spin" />
                      : <Upload className="w-7 h-7 text-slate-300 mx-auto mb-2" />}
                    <p className="text-sm font-semibold text-slate-600">{busy === 'reading' ? 'Revisando el archivo…' : '2. Elige el archivo lleno'}</p>
                    <p className="text-xs text-slate-400 mt-1">Excel (.xlsx) o CSV separado por coma o punto y coma</p>
                  </label>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-accent-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-800 truncate">{file?.name}</span>
                      <span className="text-xs font-bold bg-accent-100 text-accent-600 px-2 py-0.5 rounded-full shrink-0">
                        {preview.total} lead{plural(preview.total)}
                      </span>
                    </div>
                    {!importing && (
                      <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors shrink-0">Cambiar archivo</button>
                    )}
                  </div>

                  {preview.total > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Empresa</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Contacto</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.preview.map((l, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 font-semibold text-slate-700 truncate max-w-[140px]">{l.company || '—'}</td>
                              <td className="px-3 py-1.5 text-slate-600 truncate max-w-[120px]">{l.contact || '—'}</td>
                              <td className="px-3 py-1.5 text-slate-400 truncate max-w-[150px]">{l.email || '—'}</td>
                            </tr>
                          ))}
                          {preview.total > preview.preview.length && (
                            <tr><td colSpan={3} className="px-3 py-1.5 text-center text-slate-400">… y {preview.total - preview.preview.length} más</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <IssueList
                    title={`${preview.invalidCount} fila${plural(preview.invalidCount)} no se importará${plural(preview.invalidCount, 'n')}`}
                    items={preview.invalid} total={preview.invalidCount}
                  />

                  <p className="text-[11px] text-slate-500">
                    Los contactos con email ya registrado se omiten. Los leads quedan asignados a ti.
                  </p>

                  <button
                    onClick={runImport} disabled={importing || preview.total === 0}
                    className="bg-accent-600 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando {preview.total} leads…</>
                      : <><Upload className="w-4 h-4" /> Importar {preview.total} lead{plural(preview.total)}</>}
                  </button>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
