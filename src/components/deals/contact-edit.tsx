'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X, User, Building2, Mail, Phone, Briefcase, Globe } from 'lucide-react'

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-all">{value}</p>
      </div>
    </div>
  )
}

function EditInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
    </div>
  )
}

export default function ContactEdit({ contact, company }: { contact: any; company: any }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const [contactData, setContactData] = useState({ full_name: contact?.full_name ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '', job_title: contact?.job_title ?? '' })
  const [companyData, setCompanyData] = useState({ name: company?.name ?? '', industry: company?.industry ?? '', website: company?.website ?? '' })

  async function save() {
    setSaving(true)
    const supabase = createClient()
    if (contact?.id) await supabase.from('contacts').update(contactData).eq('id', contact.id)
    if (company?.id) await supabase.from('companies').update(companyData).eq('id', company.id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Editando datos</h2>
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-1.5 rounded-xl disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Check className="w-3 h-3" />{saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-600 px-3.5 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
              <X className="w-3 h-3" />Cancelar
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><User className="w-3 h-3" />Contacto</p>
          <div className="space-y-2">
            <EditInput label="Nombre" value={contactData.full_name} onChange={v => setContactData(p => ({ ...p, full_name: v }))} />
            <EditInput label="Email" value={contactData.email} onChange={v => setContactData(p => ({ ...p, email: v }))} />
            <EditInput label="Teléfono" value={contactData.phone} onChange={v => setContactData(p => ({ ...p, phone: v }))} />
            <EditInput label="Cargo" value={contactData.job_title} onChange={v => setContactData(p => ({ ...p, job_title: v }))} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Building2 className="w-3 h-3" />Empresa</p>
          <div className="space-y-2">
            <EditInput label="Nombre" value={companyData.name} onChange={v => setCompanyData(p => ({ ...p, name: v }))} />
            <EditInput label="Industria" value={companyData.industry} onChange={v => setCompanyData(p => ({ ...p, industry: v }))} />
            <EditInput label="Sitio web" value={companyData.website} onChange={v => setCompanyData(p => ({ ...p, website: v }))} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Contacto
          </h2>
          <button onClick={() => setEditing(true)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          <InfoRow icon={User}     label="Nombre"  value={contact?.full_name} />
          <InfoRow icon={Mail}     label="Email"   value={contact?.email} />
          <InfoRow icon={Phone}    label="Teléfono" value={contact?.phone} />
          <InfoRow icon={Briefcase} label="Cargo"  value={contact?.job_title} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Empresa
          </h2>
          <button onClick={() => setEditing(true)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          <InfoRow icon={Building2} label="Nombre"    value={company?.name} />
          <InfoRow icon={Briefcase} label="Industria" value={company?.industry} />
          <InfoRow icon={Globe}     label="Sitio web" value={company?.website} />
        </div>
      </div>
    </div>
  )
}
