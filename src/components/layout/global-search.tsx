'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Building2, Users, TrendingUp, ArrowRight, Loader2, Plus, LayoutDashboard, CheckSquare,
  CalendarDays, Bell, BarChart3, GitBranch, FolderOpen, UserCog, Wallet,
} from 'lucide-react'
import { formatMoney, getInitials } from '@/lib/format'
import { type Stage, stageByKey, colorOf } from '@/lib/stages'
import { useDialog } from '@/lib/use-dialog'
import { useCurrency } from '@/components/providers/currency-provider'

type Command = { icon: React.ComponentType<{ className?: string }>; label: string; keywords: string; href: string }

// Paleta de comandos (patrón Attio/Linear): navegar y crear, no solo buscar.
const COMMANDS: Command[] = [
  { icon: Plus,            label: 'Crear nuevo lead',      keywords: 'nuevo crear lead deal',            href: '/leads/nuevo' },
  { icon: LayoutDashboard, label: 'Ir a Dashboard',        keywords: 'dashboard inicio resumen',         href: '/dashboard' },
  { icon: TrendingUp,      label: 'Ir a Pipeline',         keywords: 'pipeline kanban tablero embudo',   href: '/pipeline' },
  { icon: Users,           label: 'Ir a Leads',            keywords: 'leads lista prospectos',           href: '/leads' },
  { icon: Building2,       label: 'Ir a Empresas',         keywords: 'empresas companias clientes',      href: '/empresas' },
  { icon: CheckSquare,     label: 'Ir a Tareas',           keywords: 'tareas pendientes todo',           href: '/tareas' },
  { icon: Wallet,          label: 'Ir a Cobranza',         keywords: 'cobranza facturas pagos cobrar',   href: '/cobranza' },
  { icon: CalendarDays,    label: 'Ir a Calendario',       keywords: 'calendario agenda fechas',         href: '/calendario' },
  { icon: Bell,            label: 'Ir a Notificaciones',   keywords: 'notificaciones avisos alertas',    href: '/notificaciones' },
  { icon: BarChart3,       label: 'Ir a Reportes',         keywords: 'reportes informes analisis kpi',   href: '/reportes' },
  { icon: GitBranch,       label: 'Ir a Automatizaciones', keywords: 'automatizaciones reglas flujos',   href: '/automatizaciones' },
  { icon: FolderOpen,      label: 'Ir a Proyectos',        keywords: 'proyectos entregables',            href: '/proyectos' },
  { icon: UserCog,         label: 'Ir a Equipo',           keywords: 'equipo usuarios roles admin',      href: '/admin/usuarios' },
]

// Texto seguro para filtros de PostgREST: sin los caracteres que arman la
// sintaxis de .or() (coma, paréntesis) y con los comodines de ilike escapados.
function safeTerm(q: string): string {
  return q.replace(/[,()*:"\\]/g, ' ').replace(/[%_]/g, m => `\\${m}`).trim()
}

type DealHit = { id: string; stage: string; estimated_value: number | null; companies: { name: string } | null; contacts: { full_name: string } | null }
type ContactHit = { id: string; full_name: string | null; email: string | null; companies: { name: string } | null }

export default function GlobalSearch({ stages = [], allowedHrefs, variant = 'sidebar' }: {
  stages?: Stage[]
  /** Secciones visibles para el usuario; los comandos a otras no se ofrecen. */
  allowedHrefs?: string[]
  variant?: 'sidebar' | 'compact'
}) {
  const currency = useCurrency()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ deals: DealHit[]; contacts: ContactHit[] }>({ deals: [], contacts: [] })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paletteRef = useDialog(open, () => setOpen(false))

  function openPalette() { setQuery(''); setResults({ deals: [], contacts: [] }); setSelected(0); setOpen(true) }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  useEffect(() => {
    const term = safeTerm(query)
    if (term.length < 2) return
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const [dealsRes, contactsRes] = await Promise.all([
        // !inner: el filtro sobre la empresa filtra los DEALS. Sin él,
        // PostgREST devolvía cualquier deal abierto con la empresa en null.
        supabase.from('deals')
          .select('id, stage, estimated_value, companies!inner(name), contacts:primary_contact_id(full_name)')
          .eq('status', 'open').ilike('companies.name', `%${term}%`).limit(5),
        supabase.from('contacts')
          .select('id, full_name, email, companies(name)')
          .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(5),
      ])
      setResults({ deals: (dealsRes.data ?? []) as unknown as DealHit[], contacts: (contactsRes.data ?? []) as unknown as ContactHit[] })
      setLoading(false)
      setSelected(0)
    }, 220)
    return () => clearTimeout(timer)
  }, [query])

  const q = query.trim().toLowerCase()
  const available = allowedHrefs ? COMMANDS.filter(c => allowedHrefs.some(h => c.href === h || c.href.startsWith(h + '/'))) : COMMANDS
  const matchedCommands = q
    ? available.filter(c => c.label.toLowerCase().includes(q) || c.keywords.includes(q)).slice(0, 5)
    : available.slice(0, 6)
  const showResults = safeTerm(query).length >= 2

  const allItems = [
    ...matchedCommands.map(c => c.href),
    ...(showResults ? results.deals.map(d => `/leads/${d.id}`) : []),
    ...(showResults ? results.contacts.map(() => '/empresas') : []),
  ]

  function go(href: string) { router.push(href); setOpen(false) }

  function onInputKey(e: React.KeyboardEvent) {
    if (!allItems.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && allItems[selected]) go(allItems[selected])
  }

  const itemClass = (isSelected: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`

  return (
    <>
      {variant === 'sidebar' ? (
        <button onClick={openPalette}
          className="flex items-center gap-2 w-full h-8 px-2.5 text-sm rounded-md border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-[13px]">Buscar…</span>
          <kbd className="text-[11px] text-slate-400 font-sans">Ctrl K</kbd>
        </button>
      ) : (
        <button onClick={openPalette} aria-label="Buscar"
          className="flex items-center gap-2 w-full h-8 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-[13px]">
          <Search className="w-3.5 h-3.5 shrink-0" /> Buscar…
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Búsqueda y comandos">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />

          <div ref={paletteRef} tabIndex={-1} className="relative w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl border border-slate-200 outline-none">
            <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-200">
              {loading
                ? <Loader2 className="w-4 h-4 text-slate-400 shrink-0 animate-spin" />
                : <Search className="w-4 h-4 text-slate-400 shrink-0" />}
              <input aria-label="Buscar empresa, contacto o email, o escribir un comando" ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onInputKey}
                placeholder="Buscar empresa, contacto o email, o escribir un comando"
                className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400 bg-transparent" />
              <kbd className="text-[11px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Esc</kbd>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2">
              {matchedCommands.length > 0 && (
                <div>
                  <p className="px-3 pt-1 pb-1.5 text-xs font-medium text-slate-500">Acciones</p>
                  {matchedCommands.map((cmd, i) => {
                    const Icon = cmd.icon
                    return (
                      <button key={cmd.href} onClick={() => go(cmd.href)} onMouseEnter={() => setSelected(i)} className={itemClass(selected === i)}>
                        <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm text-slate-800 flex-1">{cmd.label}</span>
                        {selected === i && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {showResults && !loading && results.deals.length === 0 && results.contacts.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  Sin resultados para <span className="font-medium text-slate-800">«{query.trim()}»</span>
                </p>
              )}

              {showResults && results.deals.length > 0 && (
                <div className="mt-1">
                  <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-slate-500">Deals abiertos</p>
                  {results.deals.map((deal, i) => {
                    const idx = matchedCommands.length + i
                    const stage = stageByKey(stages, deal.stage)
                    return (
                      <button key={deal.id} onClick={() => go(`/leads/${deal.id}`)} onMouseEnter={() => setSelected(idx)} className={itemClass(selected === idx)}>
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-900 truncate">{deal.companies?.name}</p>
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${colorOf(stage).dot}`} />
                            {stage?.label ?? deal.stage}
                            {deal.contacts?.full_name && ` · ${deal.contacts.full_name}`}
                            {deal.estimated_value ? ` · ${formatMoney(deal.estimated_value, currency)}` : ''}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {showResults && results.contacts.length > 0 && (
                <div className="mt-1">
                  <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-slate-500">Contactos</p>
                  {results.contacts.map((c, i) => {
                    const idx = matchedCommands.length + results.deals.length + i
                    return (
                      <button key={c.id} onClick={() => go('/empresas')} onMouseEnter={() => setSelected(idx)} className={itemClass(selected === idx)}>
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center justify-center shrink-0">
                          {getInitials(c.full_name, c.email)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{c.email}{c.companies?.name && ` · ${c.companies.name}`}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 h-9 border-t border-slate-200 flex items-center gap-4 bg-slate-50">
              {[['↑↓', 'navegar'], ['Enter', 'abrir'], ['Esc', 'cerrar']].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <kbd className="bg-white border border-slate-200 text-slate-600 px-1.5 rounded text-[11px]">{key}</kbd>
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
