'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, CalendarDays } from 'lucide-react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  due_date: string
  is_completed: boolean
  priority: string | null
  deals: { id: string; companies: { name: string } | null } | null
  profiles: { full_name: string | null } | null
}

interface Props {
  tasks: Task[]
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const priorityColors: Record<string, string> = {
  alta:   'bg-red-500',
  media:  'bg-amber-500',
  baja:   'bg-blue-500',
}

export default function CalendarView({ tasks }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Índice de tareas por día
  const tasksByDay = useMemo(() => {
    const map: Record<number, Task[]> = {}
    tasks.forEach(t => {
      if (!t.due_date) return
      const d = new Date(t.due_date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(t)
      }
    })
    return map
  }, [tasks, year, month])

  // Tareas del día seleccionado
  const selectedTasks = selectedDay ? (tasksByDay[selectedDay] ?? []) : []

  // Construir grilla del mes
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Rellenar hasta múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="space-y-5">
      {/* Grilla del calendario */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header con navegación */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <button onClick={prev}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900">{MONTHS[month]} {year}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {Object.values(tasksByDay).reduce((s, t) => s + t.length, 0)} tareas este mes
            </p>
          </div>
          <button onClick={next}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return (
              <div key={`empty-${i}`} className="h-16 md:h-20 border-r border-b border-slate-50 last:border-r-0 bg-slate-50/30" />
            )
            const dayTasks = tasksByDay[day] ?? []
            const hasOverdue = dayTasks.some(t => !t.is_completed && new Date(t.due_date) < today)
            const isSelected = selectedDay === day
            const isTodayCell = isToday(day)

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`h-16 md:h-20 border-r border-b border-slate-100 last:border-r-0 p-1.5 cursor-pointer transition-all hover:bg-indigo-50/50 ${
                  isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${
                    isTodayCell
                      ? 'bg-indigo-600 text-white'
                      : isSelected
                        ? 'text-indigo-700 font-bold'
                        : 'text-slate-700'
                  }`}>
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center ${
                      hasOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>
                {/* Mini puntos de tareas */}
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayTasks.slice(0, 3).map(t => (
                    <div key={t.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        t.is_completed ? 'bg-emerald-400' :
                        new Date(t.due_date) < today ? 'bg-red-400' :
                        priorityColors[t.priority ?? ''] ?? 'bg-indigo-400'
                      }`}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] text-slate-400 font-bold">+{dayTasks.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      {selectedDay && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedDay} de {MONTHS[month]} de {year}
            </h2>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
              {selectedTasks.length} tarea{selectedTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="px-5 py-8 flex flex-col items-center gap-2">
              <CalendarDays className="w-8 h-8 text-slate-200" />
              <p className="text-sm text-slate-400 font-medium">Sin tareas este día</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {selectedTasks.map(task => {
                const overdue = !task.is_completed && new Date(task.due_date) < today
                return (
                  <div key={task.id} className={`px-5 py-3.5 flex items-center gap-3 ${overdue ? 'bg-red-50/30' : ''}`}>
                    <div className={`shrink-0 ${task.is_completed ? 'text-emerald-500' : overdue ? 'text-red-400' : 'text-slate-300'}`}>
                      {task.is_completed
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <Circle className="w-4 h-4" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {task.deals?.companies?.name && (
                          <span className="text-xs text-slate-500">{task.deals.companies.name}</span>
                        )}
                        {task.profiles?.full_name && (
                          <span className="text-xs text-slate-400">→ {task.profiles.full_name}</span>
                        )}
                        {overdue && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Vencida</span>
                        )}
                      </div>
                    </div>
                    {task.priority && (
                      <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority] ?? 'bg-slate-200'}`} />
                    )}
                    {task.deals?.id && (
                      <Link href={`/leads/${task.deals.id}`}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold shrink-0 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors">
                        Ver deal
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
        {[
          { color: 'bg-emerald-400', label: 'Completada' },
          { color: 'bg-red-400', label: 'Vencida' },
          { color: 'bg-red-500', label: 'Prioridad alta' },
          { color: 'bg-amber-500', label: 'Prioridad media' },
          { color: 'bg-indigo-400', label: 'Prioridad baja / sin priority' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
