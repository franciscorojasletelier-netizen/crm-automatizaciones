import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * true solo en el navegador (false en el render del servidor y en la
 * hidratación). Para portales y APIs del DOM, sin setState en un efecto.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
