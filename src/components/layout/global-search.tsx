'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Building2, Users, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'

const stageLabels: Record<string, string> = {
  nuevo_lead: 'Nuevo Lead', contactado: 'Contactado', calificado: 'Calificado',
  reunion_agendada: 'Reunión', propuesta_enviada: 'Propuesta', negociacion: 'Negociación',
  cerrado_ganado: 'Ganado', cerrado_perdido: 'Perdido',
}

const stageDot: Record<string, string> = {
  nuevo_lead: 'bg-blue-500', contactado: 'bg-yellow-500', calificado: 'bg-purple-500',
  reunion_agendada: 'bg-indigo-500', propuesta_enviada: 'bg-orange-500',
  negociacion: 'bg-pink-500', cerrado_ganado: 'bg-green-500', cerrado_perdido: 'bg-red-500',
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ deals: any[]; contacts: any[] }>({ deals: [], contacts: [] })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults({ deals: [], contacts: [] }); setSelected(0) }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults({ deals: [], contacts: [] }); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const q = query.trim()
      const [dealsRes, contactsRes] = await Promise.all([
        supabase.from('deals').select('id, stage, estimated_value, companies(name), contacts:primary_contact_id(full_name)').eq('status', 'open').ilike('companies.name', `%${q}%`).limit(4),
        supabase.from('contacts').select('id, full_name, email, companies(name)').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(4),
      ])
      setResults({ deals: dealsRes.data ?? [], contacts: contactsRes.data ?? [] })
      setLoading(false)
      setSelected(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const allItems = [
    ...results.deals.map(d => ({ type: 'deal', data: d, href: `/leads/${d.id}` })),
    ...results.contacts.map(c => ({ type: 'contact', data: c, href: `/empresas` })),
  ]

  function go(href: string) { router.push(href); setOpen(false) }

  useEffect(() => {
    function onArrow(e: KeyboardEvent) {
      if (!open || !allItems.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && allItems[selected]) go(allItems[selected].href)
    }
    window.addEventListener('keydown', onArrow)
    return () => window.removeEventListener('keydown', onArrow)
  }, [open, allItems, selected])

  const hasResults = allItems.length > 0

  return (
    <>
      {/* Trigger en sidebar */}
      <button onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all duration-150 group mb-1">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left text-xs">Buscar...</span>
        <kbd className="text-[9px] bg-white/10 text-slate-500 group-hover:text-slate-300 px-1.5 py-0.5 rounded-md font-mono transition-colors">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl border border-slate-200/80"
            style={{ background: 'rgba(255,255,255,0.98)' }}>

            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
              {loading
                ? <Loader2 className="w-4 h-4 text-indigo-500 shrink-0 animate-spin" />
                : <Search className="w-4 h-4 text-slate-400 shrink-0" />
              }
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar empresa, contacto, email..."
                className="flex-1 text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400 bg-transparent" />
              {query && (
                <button onClick={() => setQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium transition-colors">
                  Esc
                </button>
              )}
            </div>

            {/* Resultados */}
            <div className="max-h-[380px] overflow-y-auto">
              {!loading && !query && (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">Escribe para buscar</p>
                  <p className="text-xs text-slate-300 mt-0.5">Empresas, contactos, leads</p>
                </div>
              )}

              {!loading && query && !hasResults && (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400 font-medium">Sin resultados para</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">"{query}"</p>
                </div>
              )}

              {results.deals.length > 0 && (
                <div className="py-2">
                  <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Leads
                  </p>
                  {results.deals.map((deal: any, i: number) => {
                    const idx = i
                    const isSelected = selected === idx
                    return (
                      <button key={deal.id} onClick={() => go(`/leads/${deal.id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{deal.companies?.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${stageDot[deal.stage] ?? 'bg-slate-400'}`} />
                            <p className="text-xs text-slate-400 truncate">
                              {deal.contacts?.full_name && `${deal.contacts.full_name} · `}
                              {stageLabels[deal.stage] ?? deal.stage}
                              {deal.estimated_value && ` · $${Number(deal.estimated_value).toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`} />
                      </button>
                    )
                  })}
                </div>
              )}

              {results.contacts.length > 0 && (
                <div className="py-2 border-t border-slate-50">
                  <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Contactos
                  </p>
                  {results.contacts.map((c: any, i: number) => {
                    const idx = results.deals.length + i
                    const isSelected = selected === idx
                    return (
                      <button key={c.id} onClick={() => go('/empresas')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                        <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-purple-600">
                            {(c.full_name ?? '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">{c.email}{c.companies?.name && ` · ${c.companies.name}`}</p>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 bg-slate-50/80">
              {[['↑↓', 'navegar'], ['↵', 'abrir'], ['Esc', 'cerrar']].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <kbd className="bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md font-mono text-[10px] shadow-sm">{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
