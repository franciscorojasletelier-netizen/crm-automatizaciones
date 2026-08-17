'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { Pipeline } from '@/lib/stages'

export default function PipelineSwitcher({ pipelines, selectedId }: { pipelines: Pipeline[]; selectedId: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={e => router.push(`${pathname}?pipeline=${e.target.value}`)}
        className="appearance-none text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 pl-3 pr-8 py-1.5 rounded-xl cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-indigo-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}
