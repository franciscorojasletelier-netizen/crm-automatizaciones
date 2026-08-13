'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, TrendingUp, AlertCircle, CheckCircle2, ListPlus } from 'lucide-react'
import type { FieldDefinition } from '@/lib/fields'

const sources = ['Formulario web', 'Meta Ads', 'LinkedIn', 'Referido', 'Llamada directa', 'Otro']
const industries = ['Tecnología', 'Manufactura', 'Retail', 'Salud', 'Educación', 'Logística', 'Finanzas', 'Construcción', 'Otro']

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder:text-slate-400 text-slate-900 transition-all"

export default function NuevoLeadForm({ dealFields = [] }: { dealFields?: FieldDefinition[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    company_name: '', industry: '', website: '',
    contact_name: '', contact_email: '', contact_phone: '', contact_job_title: '',
    source: '', estimated_value: '', next_action: '',
  })
  const [customValues, setCustomValues] = useState<Record<string, any>>({})

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }
  function setCustom(key: string, value: any) { setCustomValues(v => ({ ...v, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const missing = dealFields.find(f => f.isRequired && !customValues[f.key])
    if (missing) {
      setError(`El campo "${missing.label}" es obligatorio`)
      setLoading(false)
      return
    }

    try {
      const { data: company, error: companyError } = await supabase
        .from('companies').insert({ name: form.company_name, industry: form.industry, website: form.website }).select('id').single()
      if (companyError) throw companyError

      const { data: contact, error: contactError } = await supabase
        .from('contacts').insert({ company_id: company.id, full_name: form.contact_name, email: form.contact_email, phone: form.contact_phone, job_title: form.contact_job_title }).select('id').single()
      if (contactError) throw contactError

      let score = 0
      if (form.contact_email && !form.contact_email.includes('gmail') && !form.contact_email.includes('hotmail')) score += 15
      if (form.source === 'Meta Ads' || form.source === 'LinkedIn') score += 10
      if (form.industry) score += 5

      // Asignar al usuario que lo crea — sin esto, un comercial no vería su propio lead
      const { data: { user } } = await supabase.auth.getUser()

      const { error: dealError } = await supabase.from('deals').insert({
        company_id: company.id, primary_contact_id: contact.id, source: form.source,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        // `stage` se omite a propósito: el trigger set_default_stage_on_deal
        // asigna la etapa inicial que tenga configurada esta organización.
        next_action: form.next_action, score, status: 'open',
        owner_id: user?.id ?? null,
        custom_fields: customValues,
      })
      if (dealError) throw dealError
      router.push('/leads')
    } catch (err: any) {
      setError(`Error: ${err?.message ?? err?.code ?? JSON.stringify(err)}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Volver a leads
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo lead</h1>
          <p className="text-sm text-slate-500 mt-0.5">Completa la información para crear un nuevo deal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Empresa */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Empresa</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Nombre" required>
                  <input required value={form.company_name} onChange={e => set('company_name', e.target.value)} className={inputCls} placeholder="Empresa S.A." />
                </Field>
              </div>
              <Field label="Industria">
                <select value={form.industry} onChange={e => set('industry', e.target.value)} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Sitio web">
                <input value={form.website} onChange={e => set('website', e.target.value)} className={inputCls} placeholder="https://empresa.com" />
              </Field>
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Contacto principal</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Nombre completo" required>
                  <input required value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputCls} placeholder="Juan Pérez" />
                </Field>
              </div>
              <Field label="Email">
                <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputCls} placeholder="juan@empresa.com" />
              </Field>
              <Field label="Teléfono">
                <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={inputCls} placeholder="+56 9 1234 5678" />
              </Field>
              <div className="col-span-2">
                <Field label="Cargo">
                  <input value={form.contact_job_title} onChange={e => set('contact_job_title', e.target.value)} className={inputCls} placeholder="Gerente de Operaciones" />
                </Field>
              </div>
            </div>
          </div>

          {/* Oportunidad */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Oportunidad</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fuente" required>
                <select required value={form.source} onChange={e => set('source', e.target.value)} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {sources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Valor estimado (CLP)">
                <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)} className={inputCls} placeholder="5.000.000" />
              </Field>
              <div className="col-span-2">
                <Field label="Próxima acción">
                  <input value={form.next_action} onChange={e => set('next_action', e.target.value)} className={inputCls} placeholder="Llamar para agendar demo" />
                </Field>
              </div>
            </div>
          </div>

          {/* Campos personalizados de esta organización */}
          {dealFields.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <ListPlus className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Campos adicionales</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {dealFields.map(f => (
                  <div key={f.id} className={f.fieldType === 'textarea' || f.fieldType === 'multiselect' ? 'col-span-2' : ''}>
                    <Field label={f.label} required={f.isRequired}>
                      {f.fieldType === 'textarea' && (
                        <textarea rows={2} placeholder={f.placeholder ?? ''} value={customValues[f.key] ?? ''}
                          onChange={e => setCustom(f.key, e.target.value)} className={inputCls} />
                      )}
                      {(f.fieldType === 'text' || f.fieldType === 'number' || f.fieldType === 'currency' || f.fieldType === 'date') && (
                        <input
                          type={f.fieldType === 'number' || f.fieldType === 'currency' ? 'number' : f.fieldType === 'date' ? 'date' : 'text'}
                          placeholder={f.placeholder ?? ''} value={customValues[f.key] ?? ''}
                          onChange={e => setCustom(f.key, e.target.value)} className={inputCls} />
                      )}
                      {f.fieldType === 'select' && (
                        <select value={customValues[f.key] ?? ''} onChange={e => setCustom(f.key, e.target.value)} className={inputCls}>
                          <option value="">Seleccionar</option>
                          {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                      {f.fieldType === 'multiselect' && (
                        <div className="flex flex-wrap gap-1.5">
                          {f.options.map(o => {
                            const selected: string[] = customValues[f.key] ?? []
                            const checked = selected.includes(o.value)
                            return (
                              <button key={o.value} type="button"
                                onClick={() => setCustom(f.key, checked ? selected.filter(v => v !== o.value) : [...selected, o.value])}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                                  checked ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}>
                                {o.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {f.fieldType === 'boolean' && (
                        <button type="button" onClick={() => setCustom(f.key, !customValues[f.key])}
                          className={`text-xs px-3 py-2 rounded-xl border font-semibold transition-colors ${
                            customValues[f.key] ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'
                          }`}>
                          {customValues[f.key] ? 'Sí' : 'No'}
                        </button>
                      )}
                    </Field>
                    {f.helpText && <p className="text-[10px] text-slate-400 mt-1">{f.helpText}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl disabled:opacity-50 hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Guardando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" />Crear lead</>
              )}
            </button>
            <Link href="/leads" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
