'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Circle, CheckCircle, AlertCircle } from 'lucide-react'

export default function TaskCheck({ taskId, isCompleted, isOverdue }: {
  taskId: string
  isCompleted: boolean
  isOverdue: boolean
}) {
  const [done, setDone] = useState(isCompleted)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('tasks').update({ is_completed: !done }).eq('id', taskId)
    setDone(!done)
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={loading} className="mt-0.5 shrink-0 hover:scale-110 transition-transform disabled:opacity-50">
      {done
        ? <CheckCircle className="w-4 h-4 text-green-500" />
        : isOverdue
          ? <AlertCircle className="w-4 h-4 text-red-500" />
          : <Circle className="w-4 h-4 text-gray-300 hover:text-gray-500" />
      }
    </button>
  )
}
