'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const sources = ['Formulario web', 'Meta Ads', 'LinkedIn', 'Referido', 'Llamada directa', 'Otro']
const industries = ['Tecnología', 'Manufactura', 'Retail', 'Salud', 'Educación', 'Logística', 'Finanzas', 'Construcción', 'Otro']

export default function NuevoLeadForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    website: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_job_title: '',
    source: '',
    estimated_value: '',
    next_action: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: form.company_name, industry: form.industry, website: form.website })
        .select('id')
        .single()

      if (companyError) throw companyError

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: company.id,
          full_name: form.contact_name,
          email: form.contact_email,
          phone: form.contact_phone,
          job_title: form.contact_job_title,
        })
        .select('id')
        .single()

      if (contactError) throw contactError

      let score = 0
      if (form.contact_email && !form.contact_email.includes('gmail') && !form.contact_email.includes('hotmail')) score += 15
      if (form.source === 'Meta Ads' || form.source === 'LinkedIn') score += 10
      if (form.industry) score += 5

      const { error: dealError } = await supabase
        .from('deals')
        .insert({
          company_id: company.id,
          primary_contact_id: contact.id,
          source: form.source,
          estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
          next_action: form.next_action,
          score,
          stage: 'nuevo_lead',
          status: 'open',
        })

      if (dealError) throw dealError

      router.push('/leads')
    } catch (err: any) {
      setError(`Error: ${err?.message ?? err?.code ?? JSON.stringify(err)}`)
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a leads
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input required value={form.company_name} onChange={e => set('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Empresa S.A." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Industria</label>
              <select value={form.industry} onChange={e => set('industry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Seleccionar</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sitio web</label>
              <input value={form.website} onChange={e => set('website', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="https://empresa.com" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Contacto principal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
              <input required value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="juan@empresa.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="+56 9 1234 5678" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
              <input value={form.contact_job_title} onChange={e => set('contact_job_title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Gerente de Operaciones" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Oportunidad</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fuente *</label>
              <select required value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Seleccionar</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor estimado (USD)</label>
              <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="5000" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Próxima acción</label>
              <input value={form.next_action} onChange={e => set('next_action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Llamar para agendar demo" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : 'Crear lead'}
          </button>
          <Link href="/leads"
            className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
