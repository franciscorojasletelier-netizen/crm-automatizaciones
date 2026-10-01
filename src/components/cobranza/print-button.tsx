'use client'

import { Printer } from 'lucide-react'
import { buttonClass } from '@/components/ui/page'

export default function PrintButton({ label = 'Imprimir / PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass.secondary}>
      <Printer className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
