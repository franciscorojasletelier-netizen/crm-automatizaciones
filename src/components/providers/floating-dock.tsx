'use client'

// Botones flotantes (chat del equipo, WhatsApp del lead) en el celular:
// escondidos tras una pestaña en el borde derecho para que no tapen el
// contenido. Al tocarla aparecen y se vuelven a esconder solos. En
// escritorio (md+) siempre están visibles.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'

interface Dock {
  /** Los botones se están mostrando (en celular). */
  open: boolean
  close: () => void
  /** Cada widget informa sus mensajes sin leer para el punto de la pestaña. */
  report: (key: string, unread: number) => void
}

const DockContext = createContext<Dock>({ open: true, close: () => {}, report: () => {} })

export const useFloatingDock = () => useContext(DockContext)

/** Clases para el contenedor de un botón flotante: oculto en celular salvo que el dock o su panel estén abiertos. */
export const dockHiddenClass = 'max-md:translate-x-[calc(100%+1.5rem)] max-md:opacity-0 max-md:pointer-events-none'

const AUTO_HIDE_MS = 6000

export function FloatingDockProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setOpen(false), AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [open])

  const report = useCallback((key: string, unread: number) => {
    setBadges(prev => (prev[key] === unread ? prev : { ...prev, [key]: unread }))
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ open, close, report }), [open, close, report])
  const unread = Object.values(badges).reduce((s, n) => s + n, 0)

  return (
    <DockContext.Provider value={value}>
      {children}
      <button type="button" onClick={() => setOpen(true)} aria-label={unread ? `Mostrar chats (${unread} sin leer)` : 'Mostrar chats'} aria-expanded={open}
        className={`md:hidden print:hidden fixed right-0 bottom-36 z-40 w-6 h-14 rounded-l-xl bg-accent-600 text-white shadow-lg flex items-center justify-center transition-transform duration-200 ${open ? 'translate-x-full' : ''}`}>
        <ChevronLeft className="w-4 h-4" />
        {unread > 0 && <span aria-hidden className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />}
      </button>
    </DockContext.Provider>
  )
}
