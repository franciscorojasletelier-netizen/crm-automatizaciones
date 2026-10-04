'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="flex items-center gap-2 text-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 px-4 py-2 rounded-lg">
      <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
    </button>
  )
}
