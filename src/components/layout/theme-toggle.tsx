'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemeChoice } from '@/lib/theme'
const ORDER: ThemeChoice[] = ['sistema', 'claro', 'oscuro']
const META: Record<ThemeChoice, { label: string; icon: typeof Sun }> = {
  sistema: { label: 'Tema: según el sistema', icon: Monitor },
  claro:   { label: 'Tema: claro', icon: Sun },
  oscuro:  { label: 'Tema: oscuro', icon: Moon },
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'oscuro' || (choice === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'claro' || v === 'oscuro' ? v : 'sistema'
  } catch { return 'sistema' }
}

export default function ThemeToggle() {
  // null hasta montar: el servidor no conoce la preferencia guardada.
  const [choice, setChoice] = useState<ThemeChoice | null>(null)

  useEffect(() => {
    const initial = readChoice()
    setChoice(initial) // eslint-disable-line react-hooks/set-state-in-effect -- sincroniza con localStorage tras montar
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (readChoice() === 'sistema') apply('sistema') }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const current = choice ?? 'sistema'
  const { label, icon: Icon } = META[current]

  function cycle() {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
    setChoice(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    apply(next)
  }

  return (
    <button type="button" onClick={cycle} aria-label={`${label}. Cambiar tema`} title={label}
      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  )
}
