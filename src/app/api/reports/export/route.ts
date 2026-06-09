import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function esc(v: any): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(...cells: any[]): string {
  return cells.map(esc).join(',')
}

function section(title: string): string {
  return `\n"=== ${title} ==="\n`
}

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    // Fetch all data in parallel
    const [dealsAll, wonDeals, lostDeals, tasks, profiles, companies] = await Promise.all([
      supabase.from('deals').select(`
        id, stage, status, estimated_value, source, score, created_at, updated_at, next_action, lost_reason,
        companies(name, industry),
        profiles:owner_id(full_name)
      `).order('updated_at', { ascending: false }).limit(500),

      supabase.from('deals').select('id, estimated_value, updated_at, stage, companies(name), profiles:owner_id(full_name)')
        .eq('status', 'won').order('updated_at', { ascending: false }),

      supabase.from('deals').select('id, estimated_value, lost_reason, updated_at, companies(name)')
        .eq('status', 'lost'),

      supabase.from('tasks').select('id, title, is_completed, due_date, deals(companies(name)), profiles:assigned_to(full_name)')
        .order('due_date', { ascending: false }).limit(200),

      supabase.from('profiles').select('id, full_name, email, role, is_active'),

      supabase.from('companies').select('id, name, industry, type').limit(200),
    ])

    // Monthly revenue (last 6 months)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        label: d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }),
        start: d.toISOString(),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      }
    })

    const monthlyRevenue = await Promise.all(months.map(async m => {
      const { data } = await supabase.from('deals').select('estimated_value')
        .eq('status', 'won').gte('updated_at', m.start).lte('updated_at', m.end)
      const rev = data?.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0) ?? 0
      return { label: m.label, revenue: rev }
    }))

    // Compute stats
    const allDealsData = dealsAll.data ?? []
    const wonData      = wonDeals.data ?? []
    const lostData     = lostDeals.data ?? []
    const tasksData    = tasks.data ?? []
    const profilesData = profiles.data ?? []

    const totalWon     = wonData.length
    const totalLost    = lostData.length
    const totalRevenue = wonData.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0)
    const avgDealSize  = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0
    const winRate      = (totalWon + totalLost) > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0

    // Per-executive stats
    const execStats: Record<string, { name: string; won: number; lost: number; open: number; revenue: number }> = {}
    allDealsData.forEach((d: any) => {
      const name = d.profiles?.full_name ?? 'Sin asignar'
      if (!execStats[name]) execStats[name] = { name, won: 0, lost: 0, open: 0, revenue: 0 }
      if (d.status === 'won')  { execStats[name].won++;  execStats[name].revenue += Number(d.estimated_value) || 0 }
      if (d.status === 'lost') { execStats[name].lost++ }
      if (d.status === 'open') { execStats[name].open++ }
    })

    // Stage distribution
    const stageDist: Record<string, number> = {}
    allDealsData.forEach((d: any) => { stageDist[d.stage] = (stageDist[d.stage] || 0) + 1 })

    // Source distribution
    const sourceDist: Record<string, number> = {}
    allDealsData.forEach((d: any) => {
      const s = d.source || 'Sin fuente'
      sourceDist[s] = (sourceDist[s] || 0) + 1
    })

    const STAGE_LABELS: Record<string, string> = {
      nuevo_lead: 'Nuevo Lead', contactado: 'Contactado', calificado: 'Calificado',
      reunion_agendada: 'Reunión Agendada', reunion_realizada: 'Reunión Realizada',
      propuesta_enviada: 'Propuesta Enviada', negociacion: 'Negociación',
      cerrado_ganado: 'Ganado', cerrado_perdido: 'Perdido',
      no_calificado: 'No Calificado', frio: 'Frío',
    }

    // Build CSV
    const lines: string[] = []
    const exportDate = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    lines.push(row('REPORTE CRM AUTOMATIZACIONES', '', exportDate))
    lines.push('')

    // ─── KPIs Generales ───────────────────────────────────────
    lines.push(section('RESUMEN GENERAL'))
    lines.push(row('Métrica', 'Valor'))
    lines.push(row('Revenue Total (Deals Ganados)', `$${totalRevenue.toLocaleString()}`))
    lines.push(row('Win Rate', `${winRate}%`))
    lines.push(row('Deals Ganados', totalWon))
    lines.push(row('Deals Perdidos', totalLost))
    lines.push(row('Valor Promedio por Deal', `$${avgDealSize.toLocaleString()}`))
    lines.push(row('Deals Activos (Pipeline)', allDealsData.filter(d => d.status === 'open').length))
    lines.push(row('Tareas Vencidas', tasksData.filter((t: any) => !t.is_completed && t.due_date && new Date(t.due_date) < now).length))
    lines.push(row('Tareas Completadas', tasksData.filter((t: any) => t.is_completed).length))
    lines.push('')

    // ─── Revenue Mensual ───────────────────────────────────────
    lines.push(section('REVENUE MENSUAL (ÚLTIMOS 6 MESES)'))
    lines.push(row('Mes', 'Revenue ($)', 'Revenue Formateado'))
    monthlyRevenue.forEach(m => {
      lines.push(row(m.label, m.revenue, `$${m.revenue.toLocaleString()}`))
    })
    lines.push('')

    // ─── Embudo de Conversión ──────────────────────────────────
    lines.push(section('EMBUDO DE CONVERSIÓN POR ETAPA'))
    lines.push(row('Etapa', 'Cantidad de Deals', '% del Total'))
    const totalForPct = allDealsData.length || 1
    Object.entries(stageDist).sort((a,b)=>b[1]-a[1]).forEach(([stage, count]) => {
      const pct = Math.round((count / totalForPct) * 100)
      lines.push(row(STAGE_LABELS[stage] ?? stage, count, `${pct}%`))
    })
    lines.push('')

    // ─── Distribución por Fuente ───────────────────────────────
    lines.push(section('DISTRIBUCIÓN POR FUENTE'))
    lines.push(row('Fuente', 'Cantidad', '% del Total'))
    Object.entries(sourceDist).sort((a,b)=>b[1]-a[1]).forEach(([source, count]) => {
      const pct = Math.round((count / totalForPct) * 100)
      lines.push(row(source, count, `${pct}%`))
    })
    lines.push('')

    // ─── Leaderboard Ejecutivos ────────────────────────────────
    lines.push(section('LEADERBOARD DE EJECUTIVOS'))
    lines.push(row('#', 'Ejecutivo', 'Revenue ($)', 'Deals Ganados', 'Deals Perdidos', 'En Curso', 'Win Rate'))
    Object.values(execStats).sort((a,b)=>b.revenue-a.revenue).forEach((exec, i) => {
      const total = exec.won + exec.lost
      const wr = total > 0 ? Math.round((exec.won / total) * 100) : 0
      lines.push(row(i + 1, exec.name, exec.revenue, exec.won, exec.lost, exec.open, `${wr}%`))
    })
    lines.push('')

    // ─── Todos los Deals ──────────────────────────────────────
    lines.push(section('TODOS LOS DEALS'))
    lines.push(row('Empresa', 'Industria', 'Etapa', 'Estado', 'Valor Estimado ($)', 'Responsable', 'Fuente', 'Score', 'Próxima Acción', 'Fecha Actualización'))
    allDealsData.forEach((d: any) => {
      lines.push(row(
        d.companies?.name ?? '',
        d.companies?.industry ?? '',
        STAGE_LABELS[d.stage] ?? d.stage,
        d.status === 'won' ? 'Ganado' : d.status === 'lost' ? 'Perdido' : 'Activo',
        Number(d.estimated_value) || 0,
        d.profiles?.full_name ?? '',
        d.source ?? '',
        d.score ?? 0,
        d.next_action ?? '',
        d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '',
      ))
    })
    lines.push('')

    // ─── Deals Ganados ────────────────────────────────────────
    lines.push(section('DEALS GANADOS'))
    lines.push(row('Empresa', 'Valor ($)', 'Responsable', 'Fecha de Cierre'))
    wonData.forEach((d: any) => {
      lines.push(row(
        d.companies?.name ?? '',
        Number(d.estimated_value) || 0,
        d.profiles?.full_name ?? '',
        d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '',
      ))
    })
    lines.push('')

    // ─── Deals Perdidos ───────────────────────────────────────
    lines.push(section('DEALS PERDIDOS'))
    lines.push(row('Empresa', 'Valor ($)', 'Motivo de Pérdida', 'Fecha'))
    lostData.forEach((d: any) => {
      lines.push(row(
        d.companies?.name ?? '',
        Number(d.estimated_value) || 0,
        d.lost_reason ?? '',
        d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '',
      ))
    })
    lines.push('')

    // ─── Tareas ───────────────────────────────────────────────
    lines.push(section('TAREAS'))
    lines.push(row('Tarea', 'Empresa', 'Responsable', 'Fecha Vencimiento', 'Estado'))
    tasksData.forEach((t: any) => {
      const isOverdue = !t.is_completed && t.due_date && new Date(t.due_date) < now
      lines.push(row(
        t.title,
        t.deals?.companies?.name ?? '',
        t.profiles?.full_name ?? '',
        t.due_date ? new Date(t.due_date).toLocaleDateString('es-CL') : '',
        t.is_completed ? 'Completada' : isOverdue ? 'Vencida' : 'Pendiente',
      ))
    })
    lines.push('')

    // ─── Equipo ───────────────────────────────────────────────
    lines.push(section('EQUIPO'))
    lines.push(row('Nombre', 'Email', 'Rol', 'Estado'))
    const ROLE_LABELS: Record<string, string> = {
      super_admin: 'Super Admin', admin: 'Super Admin', gerente: 'Gerente',
      comercial: 'Ejecutivo de Ventas', produccion: 'Producción', soporte: 'Soporte / Analista',
    }
    profilesData.forEach((p: any) => {
      lines.push(row(p.full_name ?? '', p.email ?? '', ROLE_LABELS[p.role] ?? p.role, p.is_active ? 'Activo' : 'Inactivo'))
    })

    const csv = lines.join('\n')

    // BOM para que Excel lo abra en UTF-8 correctamente
    const bom = '﻿'
    const body = bom + csv

    const filename = `reporte-crm-${now.toISOString().slice(0, 10)}.csv`

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error generando reporte' }, { status: 500 })
  }
}
