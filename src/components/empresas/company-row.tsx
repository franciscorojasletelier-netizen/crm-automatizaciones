'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Pencil, Check, X, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import DynamicFields from '@/components/fields/dynamic-fields'
import type { FieldDefinition } from '@/lib/fields'

export default function CompanyRow({ company, dealId, canEdit = true, fields = [] }: { company: any; dealId?: string; canEdit?: boolean; fields?: FieldDefinition[] }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    name: company.name ?? '',
    industry: company.industry ?? '',
    website: company.website ?? '',
    country: company.country ?? '',
    is_existing_client: company.is_existing_client ?? false,
  })
  const router = useRouter()
  const activeDeals = company.deals?.filter((d: any) => d.status === 'open').length ?? 0

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('companies').update(data).eq('id', company.id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing && canEdit) {
    return (
      <tr className="bg-indigo-50/60">
        <td className="px-5 py-4" colSpan={5}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Nombre', key: 'name' },
                { label: 'Industria', key: 'industry' },
                { label: 'Sitio web', key: 'website' },
                { label: 'País', key: 'country' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
                  <input
                    type="text"
                    value={(data as any)[key]}
                    onChange={e => setData(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={data.is_existing_client}
                  onChange={e => setData(p => ({ ...p, is_existing_client: e.target.checked }))}
                  className="rounded accent-indigo-600"
                />
                <span className="font-medium">Es cliente activo</span>
              </label>
            </div>
            {fields.length > 0 && (
              <div className="pt-1 border-t border-slate-100">
                <DynamicFields entity="company" entityId={company.id} fields={fields} values={company.custom_fields ?? {}} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex gap-2 ml-auto">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-1.5 rounded-xl hover:shadow-md disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Check className="w-3 h-3" />{saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white text-slate-600 border border-slate-200 px-3.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <X className="w-3 h-3" />Cancelar
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-indigo-50/30 transition-colors group">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div className="min-w-0">
            {dealId ? (
              <Link href={`/leads/${dealId}`}
                className="font-semibold text-slate-900 hover:text-indigo-700 transition-colors">
                {data.name}
              </Link>
            ) : (
              <p className="font-semibold text-slate-900">{data.name}</p>
            )}
            {data.website && (
              <a href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors truncate max-w-[150px]"
                onClick={e => e.stopPropagation()}>
                {data.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 hidden md:table-cell">
        {data.industry
          ? <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">{data.industry}</span>
          : <span className="text-slate-300">—</span>
        }
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell">
        <span className="text-sm font-semibold text-slate-700">{company.contacts?.length ?? 0}</span>
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell">
        {activeDeals > 0
          ? <span className="text-xs font-bold bg-blue-100 text-blue-700 ring-1 ring-blue-200 px-2.5 py-1 rounded-full">{activeDeals}</span>
          : <span className="text-slate-300 text-sm">0</span>
        }
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${
            data.is_existing_client
              ? 'bg-green-100 text-green-700 ring-green-200'
              : 'bg-blue-100 text-blue-700 ring-blue-200'
          }`}>
            {data.is_existing_client ? 'Cliente' : 'Prospecto'}
          </span>
          {canEdit && (
            <button onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
