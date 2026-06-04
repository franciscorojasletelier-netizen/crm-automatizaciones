'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  )
}

export default function ContactEdit({ contact, company }: { contact: any; company: any }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const [contactData, setContactData] = useState({
    full_name: contact?.full_name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    job_title: contact?.job_title ?? '',
  })
  const [companyData, setCompanyData] = useState({
    name: company?.name ?? '',
    industry: company?.industry ?? '',
    website: company?.website ?? '',
  })

  async function save() {
    setSaving(true)
    const supabase = createClient()
    if (contact?.id) {
      await supabase.from('contacts').update(contactData).eq('id', contact.id)
    }
    if (company?.id) {
      await supabase.from('companies').update(companyData).eq('id', company.id)
    }
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {/* Contacto */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto</h2>
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Nombre', value: contact?.full_name },
              { label: 'Email', value: contact?.email },
              { label: 'Teléfono', value: contact?.phone },
              { label: 'Cargo', value: contact?.job_title },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm text-gray-800">{value}</p>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</h2>
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Nombre', value: company?.name },
              { label: 'Industria', value: company?.industry },
              { label: 'Web', value: company?.website },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm text-gray-800">{value}</p>
              </div>
            ) : null)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editando datos</h2>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-1 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            <Check className="w-3 h-3" />{saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">
            <X className="w-3 h-3" />Cancelar
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Contacto</p>
        <div className="space-y-2">
          <Field label="Nombre" value={contactData.full_name} onChange={v => setContactData(p => ({ ...p, full_name: v }))} />
          <Field label="Email" value={contactData.email} onChange={v => setContactData(p => ({ ...p, email: v }))} />
          <Field label="Teléfono" value={contactData.phone} onChange={v => setContactData(p => ({ ...p, phone: v }))} />
          <Field label="Cargo" value={contactData.job_title} onChange={v => setContactData(p => ({ ...p, job_title: v }))} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Empresa</p>
        <div className="space-y-2">
          <Field label="Nombre" value={companyData.name} onChange={v => setCompanyData(p => ({ ...p, name: v }))} />
          <Field label="Industria" value={companyData.industry} onChange={v => setCompanyData(p => ({ ...p, industry: v }))} />
          <Field label="Sitio web" value={companyData.website} onChange={v => setCompanyData(p => ({ ...p, website: v }))} />
        </div>
      </div>
    </div>
  )
}
