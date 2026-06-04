'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Pencil, Check, X } from 'lucide-react'
import Link from 'next/link'

export default function CompanyRow({ company, dealId }: { company: any; dealId?: string }) {
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

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3" colSpan={5}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Nombre', key: 'name' },
                { label: 'Industria', key: 'industry' },
                { label: 'Sitio web', key: 'website' },
                { label: 'País', key: 'country' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <input
                    type="text"
                    value={(data as any)[key]}
                    onChange={e => setData(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.is_existing_client}
                  onChange={e => setData(p => ({ ...p, is_existing_client: e.target.checked }))}
                  className="rounded"
                />
                Es cliente activo
              </label>
              <div className="flex gap-2 ml-auto">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  <Check className="w-3 h-3" />{saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">
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
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-300 shrink-0" />
          <div className="min-w-0">
            {dealId ? (
              <Link href={`/leads/${dealId}`} className="font-medium text-gray-900 hover:underline">
                {data.name}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">{data.name}</p>
            )}
            {data.website && <p className="text-xs text-gray-400 truncate">{data.website}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{data.industry || '—'}</td>
      <td className="px-4 py-3 text-gray-600">{company.contacts?.length ?? 0}</td>
      <td className="px-4 py-3">
        <span className={`text-sm font-medium ${activeDeals > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
          {activeDeals}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${data.is_existing_client ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {data.is_existing_client ? 'Cliente' : 'Prospecto'}
          </span>
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
