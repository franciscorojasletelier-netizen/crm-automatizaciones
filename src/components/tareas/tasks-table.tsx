'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, AlertTriangle, Clock, CheckCircle2, Circle, CheckSquare, Building2, User, X } from 'lucide-react'
import TaskCheck from './task-check'

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  is_completed: boolean
  deals: { id: string; companies: { name: string } | null } | null
  profiles: { full_name: string } | null
}

function getStatus(task: Task): 'overdue' | 'soon' | 'pending' | 'completed' {
  if (task.is_completed) return 'completed'
  if (!task.due_date) return 'pending'
  const now = Date.now()
  const due = new Date(task.due_date).getTime()
  if (due < now) return 'overdue'
  if (due - now < 1000 * 60 * 60 * 48) return 'soon'
  return 'pending'
}

function formatDate(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function formatTime(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  if (d.getHours() === 0 && d.getMinutes() === 0) return null
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABELS = {
  overdue:   { label: 'Vencida',    bg: 'bg-red-50 text-red-600 border border-red-100',       icon: <AlertTriangle className="w-3 h-3" /> },
  soon:      { label: 'Por vencer', bg: 'bg-amber-50 text-amber-600 border border-amber-100', icon: <Clock className="w-3 h-3" /> },
  pending:   { label: 'Pendiente',  bg: 'bg-slate-100 text-slate-500',                        icon: <Circle className="w-3 h-3" /> },
  completed: { label: 'Completada', bg: 'bg-emerald-50 text-emerald-600',                     icon: <CheckCircle2 className="w-3 h-3" /> },
}

const FILTERS = [
  { key: 'all',       label: 'Todas' },
  { key: 'overdue',   label: 'Vencidas' },
  { key: 'soon',      label: 'Por vencer' },
  { key: 'pending',   label: 'Pendientes' },
  { key: 'completed', label: 'Completadas' },
] as const

type FilterKey = typeof FILTERS[number]['key']

export default function TasksTable({ tasks: initialTasks }: { tasks: Task[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const tasks = useMemo(() => {
    let list = initialTasks.map(t => ({ ...t, status: getStatus(t) }))

    if (filter !== 'all') {
      list = list.filter(t => t.status === filter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.deals?.companies?.name?.toLowerCase().includes(q) ||
        t.profiles?.full_name?.toLowerCase().includes(q)
      )
    }

    // Sort: overdue first, then by due_date asc, completed last
    list.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (b.status === 'completed' && a.status !== 'completed') return -1
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    return list
  }, [initialTasks, search, filter])

  const counts = useMemo(() => ({
    overdue:   initialTasks.filter(t => getStatus(t) === 'overdue').length,
    soon:      initialTasks.filter(t => getStatus(t) === 'soon').length,
    pending:   initialTasks.filter(t => getStatus(t) === 'pending').length,
    completed: initialTasks.filter(t => getStatus(t) === 'completed').length,
  }), [initialTasks])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Search + Filters bar */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por tarea, empresa, responsable..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const count = f.key === 'all' ? initialTasks.length : counts[f.key as keyof typeof counts]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === f.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tarea</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />Empresa</div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Responsable</div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Hora</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CheckSquare className="w-8 h-8 text-slate-200" />
                    <p className="text-sm text-slate-400 font-medium">
                      {search ? 'Sin resultados para esa búsqueda' : 'No hay tareas en esta categoría'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {tasks.map(task => {
              const s = STATUS_LABELS[task.status]
              const dateStr = formatDate(task.due_date)
              const timeStr = formatTime(task.due_date)
              const isOv = task.status === 'overdue'
              const isDone = task.status === 'completed'

              return (
                <tr
                  key={task.id}
                  className={`group transition-colors ${
                    isDone ? 'opacity-50 hover:opacity-70' :
                    isOv   ? 'hover:bg-red-50/30' :
                    'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Check */}
                  <td className="px-4 py-3.5 text-center">
                    <TaskCheck taskId={task.id} isCompleted={isDone} isOverdue={isOv} />
                  </td>

                  {/* Tarea */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <p className={`font-semibold text-slate-900 leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                  </td>

                  {/* Empresa */}
                  <td className="px-4 py-3.5">
                    {task.deals?.companies?.name ? (
                      <Link
                        href={`/leads/${task.deals.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {task.deals.companies.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Responsable */}
                  <td className="px-4 py-3.5">
                    {task.profiles?.full_name ? (
                      <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                        {task.profiles.full_name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Fecha */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {dateStr ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        isOv  ? 'bg-red-50 text-red-600 border border-red-100' :
                        task.status === 'soon' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-slate-100 text-slate-500'
                      }`}>{dateStr}</span>
                    ) : (
                      <span className="text-xs text-slate-300">Sin fecha</span>
                    )}
                  </td>

                  {/* Hora */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {timeStr ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />{timeStr}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit ${s.bg}`}>
                      {s.icon}{s.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {tasks.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
          {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'} mostradas
        </div>
      )}
    </div>
  )
}
