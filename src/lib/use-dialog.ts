'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento de diálogo accesible para modales y paneles laterales:
 * - Esc cierra (salvo `locked`, p. ej. mientras se guarda);
 * - al abrir, el foco entra al diálogo; al cerrar, vuelve a quien lo abrió;
 * - Tab y Shift+Tab quedan dentro del diálogo;
 * - el fondo no se desplaza mientras está abierto.
 * Devuelve la ref para el contenedor del diálogo.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, locked = false) {
  const ref = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  const lockedRef = useRef(locked)
  useEffect(() => { onCloseRef.current = onClose; lockedRef.current = locked })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[autofocus], ' + FOCUSABLE)
    ;(first ?? node)?.focus({ preventScroll: true })

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !lockedRef.current) { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null)
      if (items.length === 0) { e.preventDefault(); return }
      const firstEl = items[0], lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  return ref
}
