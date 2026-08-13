'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Power, PowerOff, Settings } from 'lucide-react'

type Org = {
  id: string
  name: string
  is_active: boolean
  created_at: string
  profiles: { count: number }[] | { count: number } | null
}

function userCount(p: Org['profiles']): number {
  if (!p) return 0
  return Array.isArray(p) ? (p[0]?.count ?? 0) : (p.count ?? 0)
}

export default function OrganizationsTable({ organizations }: { organizations: Org[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggle(org: Org) {
    const nextActive = !org.is_active
    const action = nextActive ? 'reactivar' : 'suspender'
    if (!confirm(`¿Seguro que querés ${action} "${org.name}"?${!nextActive ? ' Sus usuarios no podrán ingresar hasta que la reactives.' : ''}`)) return

    setBusyId(org.id)
    setError('')
    const res = await fetch(`/api/platform/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo actualizar la organización')
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm text-red-700">{error}</div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-slate-500">
            <th className="px-4 py-2.5 font-medium">Organización</th>
            <th className="px-4 py-2.5 font-medium">Usuarios</th>
            <th className="px-4 py-2.5 font-medium">Creada</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 font-medium text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {organizations.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hay organizaciones aún.</td></tr>
          )}
          {organizations.map(org => (
            <tr key={org.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-900">{org.name}</td>
              <td className="px-4 py-3 text-slate-500">{userCount(org.profiles)}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(org.created_at).toLocaleDateString('es-CL')}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  org.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {org.is_active ? 'Activa' : 'Suspendida'}
                </span>
              </td>
              <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                <Link
                  href={`/plataforma/${org.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configurar
                </Link>
                <button
                  onClick={() => toggle(org)}
                  disabled={busyId === org.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    org.is_active
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {org.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {org.is_active ? 'Suspender' : 'Reactivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
