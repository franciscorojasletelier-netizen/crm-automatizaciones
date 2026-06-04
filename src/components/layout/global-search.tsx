'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Building2, Users, X } from 'lucide-react'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ deals: any[], contacts: any[] }>({ deals: [], contacts: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Ctrl+K / Cmd+K para abrir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults({ deals: [], contacts: [] }); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const q = query.trim()

      const [dealsRes, contactsRes] = await Promise.all([
        supabase.from('deals')
          .select('id, stage, companies(name), contacts:primary_contact_id(full_name, email)')
          .eq('status', 'open')
          .or(`companies.name.ilike.%${q}%`)
          .limit(5),
        supabase.from('contacts')
          .select('id, full_name, email, company_id, companies(name)')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5),
      ])

      setResults({ deals: dealsRes.data ?? [], contacts: contactsRes.data ?? [] })
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function go(href: string) {
    router.push(href)
    setOpen(false)
    setQuery('')
  }

  const stageLabels: Record<string, string> = {
    nuevo_lead: 'Nuevo Lead', contactado: 'Contactado', calificado: 'Calificado',
    reunion_agendada: 'Reunión', propuesta_enviada: 'Propuesta', negociacion: 'Negociación',
    cerrado_ganado: 'Ganado', cerrado_perdido: 'Perdido',
  }

  const hasResults = results.deals.length > 0 || results.contacts.length > 0

  return (
    <>
      {/* Botón en sidebar desktop */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors mb-2"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar empresa, contacto, email..."
                className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Resultados */}
            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <p className="text-center text-sm text-gray-400 py-6">Buscando...</p>
              )}
              {!loading && query && !hasResults && (
                <p className="text-center text-sm text-gray-400 py-6">Sin resultados para "{query}"</p>
              )}
              {!loading && !query && (
                <p className="text-center text-sm text-gray-400 py-6">Escribe para buscar</p>
              )}

              {results.deals.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</p>
                  {results.deals.map((deal: any) => (
                    <button key={deal.id} onClick={() => go(`/leads/${deal.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{deal.companies?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{deal.contacts?.full_name} · {stageLabels[deal.stage] ?? deal.stage}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.contacts.length > 0 && (
                <div className="pb-2">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Contactos</p>
                  {results.contacts.map((c: any) => (
                    <button key={c.id} onClick={() => go(`/empresas`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors">
                      <Users className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.email} · {c.companies?.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[11px] text-gray-400">
              <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> seleccionar</span>
              <span><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
