import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/supabase/server'
import { getAllStages, stageLabel } from '@/lib/stages'
import * as XLSX from 'xlsx-js-style'

// ── Tipos locales ──────────────────────────────────────────────
type CellStyle = {
  fill?:      { fgColor?: { rgb: string }; patternType?: string }
  font?:      { bold?: boolean; color?: { rgb: string }; sz?: number; name?: string }
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean }
  border?:    { top?: BorderSide; bottom?: BorderSide; left?: BorderSide; right?: BorderSide }
  numFmt?:    string
}
type BorderSide = { style?: string; color?: { rgb: string } }

// ── Helpers de estilo ──────────────────────────────────────────
const PURPLE   = '6366f1'
const DARK     = '1e1b4b'
const GREEN    = '059669'
const AMBER    = 'd97706'
const RED      = 'dc2626'
const SLATE100 = 'f1f5f9'
const SLATE200 = 'e2e8f0'
const WHITE    = 'ffffff'
const SLATE700 = '334155'
const SLATE500 = '64748b'

function hStyle(bg: string, fg = WHITE, bold = true, sz = 11): CellStyle {
  return {
    fill:  { fgColor: { rgb: bg }, patternType: 'solid' },
    font:  { bold, color: { rgb: fg }, sz },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { rgb: 'c7d2fe' } },
    },
  }
}

function dStyle(bg = WHITE, fg = SLATE700, bold = false, align: 'left'|'center'|'right' = 'left'): CellStyle {
  return {
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    font: { bold, color: { rgb: fg }, sz: 10 },
    alignment: { horizontal: align, vertical: 'center' },
    border: {
      bottom: { style: 'hair', color: { rgb: SLATE200 } },
    },
  }
}

function moneyStyle(bg = WHITE): CellStyle {
  return {
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    font: { color: { rgb: GREEN }, sz: 10, bold: true },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '"$"#,##0',
    border: { bottom: { style: 'hair', color: { rgb: SLATE200 } } },
  }
}

function pctStyle(bg = WHITE): CellStyle {
  return {
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    font: { color: { rgb: PURPLE }, sz: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'hair', color: { rgb: SLATE200 } } },
  }
}

// Agrega una celda con estilo
function sc(ws: Record<string, any>, r: number, c: number, v: any, style: CellStyle) {
  const ref = XLSX.utils.encode_cell({ r, c })
  const t   = typeof v === 'number' ? 'n' : 's'
  ws[ref] = { v, t, s: style }
  if (!ws['!ref']) ws['!ref'] = ref
  else {
    const range = XLSX.utils.decode_range(ws['!ref'])
    const cell  = XLSX.utils.decode_cell(ref)
    if (cell.r < range.s.r) range.s.r = cell.r
    if (cell.c < range.s.c) range.s.c = cell.c
    if (cell.r > range.e.r) range.e.r = cell.r
    if (cell.c > range.e.c) range.e.c = cell.c
    ws['!ref'] = XLSX.utils.encode_range(range)
  }
}

function merge(ws: Record<string, any>, s: {r:number,c:number}, e: {r:number,c:number}) {
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({ s, e })
}


const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Super Admin', gerente: 'Gerente',
  comercial: 'Ejecutivo de Ventas', produccion: 'Producción', soporte: 'Soporte',
}

export async function GET() {
  try {
    const { supabase, organizationId } = await requirePermission('reportes')
    // getAllStages: un export histórico puede incluir deals en etapas
    // que ya se desactivaron.
    const stages = await getAllStages(supabase, organizationId ?? undefined)
    const now = new Date()

    // ── Datos ──────────────────────────────────────────────────
    const [dealsAll, wonDeals, lostDeals, tasks, profilesRes] = await Promise.all([
      supabase.from('deals').select(`
        id, stage, status, estimated_value, source, score, created_at, updated_at, next_action, lost_reason,
        companies(name, industry),
        profiles:owner_id(full_name)
      `).order('updated_at', { ascending: false }).limit(500),

      supabase.from('deals')
        .select('id, estimated_value, updated_at, stage, companies(name), profiles:owner_id(full_name)')
        .eq('status', 'won').order('updated_at', { ascending: false }),

      supabase.from('deals')
        .select('id, estimated_value, lost_reason, updated_at, companies(name)')
        .eq('status', 'lost'),

      supabase.from('tasks')
        .select('id, title, is_completed, due_date, deals(companies(name)), profiles:assigned_to(full_name)')
        .order('due_date', { ascending: false }).limit(200),

      supabase.from('profiles').select('id, full_name, email, role, is_active'),
    ])

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

    const allDeals     = dealsAll.data ?? []
    const wonData      = wonDeals.data ?? []
    const lostData     = lostDeals.data ?? []
    const tasksData    = tasks.data ?? []
    const profilesData = profilesRes.data ?? []

    const totalWon     = wonData.length
    const totalLost    = lostData.length
    const totalRevenue = wonData.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0)
    const avgDealSize  = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0
    const winRate      = (totalWon + totalLost) > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0

    // Per-exec stats
    const execStats: Record<string, { name: string; won: number; lost: number; open: number; revenue: number }> = {}
    allDeals.forEach((d: any) => {
      const name = d.profiles?.full_name ?? 'Sin asignar'
      if (!execStats[name]) execStats[name] = { name, won: 0, lost: 0, open: 0, revenue: 0 }
      if (d.status === 'won')  { execStats[name].won++;  execStats[name].revenue += Number(d.estimated_value) || 0 }
      if (d.status === 'lost')   execStats[name].lost++
      if (d.status === 'open')   execStats[name].open++
    })
    const stageDist: Record<string, number> = {}
    allDeals.forEach((d: any) => { stageDist[d.stage] = (stageDist[d.stage] || 0) + 1 })
    const sourceDist: Record<string, number> = {}
    allDeals.forEach((d: any) => {
      const s = d.source || 'Sin fuente'
      sourceDist[s] = (sourceDist[s] || 0) + 1
    })

    // ── Workbook ───────────────────────────────────────────────
    const wb = XLSX.utils.book_new()

    // ────────────────────────────────────────────────────────────
    // HOJA 1: RESUMEN EJECUTIVO
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }]
      ws['!rows'] = [{ hpt: 40 }, { hpt: 16 }, { hpt: 32 }, { hpt: 28 }]

      let r = 0

      // Título principal
      sc(ws, r, 0, '📊 REPORTE CRM AUTOMATIZACIONES', hStyle(DARK, WHITE, true, 14))
      sc(ws, r, 1, '', hStyle(DARK))
      sc(ws, r, 2, '', hStyle(DARK))
      sc(ws, r, 3, `Generado: ${now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`, hStyle(DARK, 'c7d2fe', false, 10))
      sc(ws, r, 4, '', hStyle(DARK))
      merge(ws, { r, c: 0 }, { r, c: 2 })
      merge(ws, { r, c: 3 }, { r, c: 4 })
      r++

      r++ // espacio

      // KPI Cards — header
      sc(ws, r, 0, '💰 Revenue Total (Ganados)',  hStyle(PURPLE))
      sc(ws, r, 1, '🏆 Win Rate',                hStyle(PURPLE))
      sc(ws, r, 2, '📈 Deals Ganados',           hStyle(PURPLE))
      sc(ws, r, 3, '💸 Ticket Promedio',         hStyle(PURPLE))
      sc(ws, r, 4, '🔥 En Pipeline',             hStyle(PURPLE))
      r++

      // KPI values
      sc(ws, r, 0, totalRevenue, { ...moneyStyle('eef2ff'), font: { color: { rgb: PURPLE }, sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '"$"#,##0', fill: { fgColor: { rgb: 'eef2ff' }, patternType: 'solid' } as any })
      sc(ws, r, 1, `${winRate}%`, { ...pctStyle('eef2ff'), font: { color: { rgb: PURPLE }, sz: 14, bold: true }, fill: { fgColor: { rgb: 'eef2ff' }, patternType: 'solid' } as any })
      sc(ws, r, 2, totalWon,     { ...dStyle('eef2ff', PURPLE, true, 'center'), font: { color: { rgb: PURPLE }, sz: 14, bold: true } })
      sc(ws, r, 3, avgDealSize,  { ...moneyStyle('eef2ff'), font: { color: { rgb: PURPLE }, sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '"$"#,##0', fill: { fgColor: { rgb: 'eef2ff' }, patternType: 'solid' } as any })
      sc(ws, r, 4, allDeals.filter(d => d.status === 'open').length, { ...dStyle('eef2ff', PURPLE, true, 'center'), font: { color: { rgb: PURPLE }, sz: 14, bold: true } })
      ;(ws['!rows'] as any[]).push({ hpt: 36 })
      r++

      r++ // espacio

      // Revenue mensual
      sc(ws, r, 0, '📅 REVENUE MENSUAL (ÚLTIMOS 6 MESES)', hStyle(SLATE700, WHITE, true, 11))
      sc(ws, r, 1, '', hStyle(SLATE700))
      sc(ws, r, 2, '', hStyle(SLATE700))
      sc(ws, r, 3, '', hStyle(SLATE700))
      sc(ws, r, 4, '', hStyle(SLATE700))
      merge(ws, { r, c: 0 }, { r, c: 4 })
      r++

      sc(ws, r, 0, 'Mes',            hStyle('334155', WHITE, true, 10))
      sc(ws, r, 1, 'Revenue (CLP)',     hStyle('334155', WHITE, true, 10))
      sc(ws, r, 2, 'Barra visual',    hStyle('334155', WHITE, true, 10))
      sc(ws, r, 3, '', hStyle('334155'))
      sc(ws, r, 4, '', hStyle('334155'))
      r++

      const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1)
      monthlyRevenue.forEach((m, i) => {
        const bg = i % 2 === 0 ? WHITE : SLATE100
        const barLen = Math.round((m.revenue / maxRev) * 20)
        const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen)
        sc(ws, r, 0, m.label,       dStyle(bg, SLATE700))
        sc(ws, r, 1, m.revenue,     { ...moneyStyle(bg), alignment: { horizontal: 'right' } })
        sc(ws, r, 2, bar,           { ...dStyle(bg, m.revenue > 0 ? PURPLE : SLATE500), font: { color: { rgb: m.revenue > 0 ? PURPLE : SLATE500 }, sz: 9 } })
        sc(ws, r, 3, '',            dStyle(bg))
        sc(ws, r, 4, '',            dStyle(bg))
        r++
      })

      r++ // espacio

      // Desglose por etapa
      sc(ws, r, 0, '🎯 EMBUDO POR ETAPA', hStyle(SLATE700, WHITE, true, 11))
      sc(ws, r, 1, '', hStyle(SLATE700))
      sc(ws, r, 2, '', hStyle(SLATE700))
      sc(ws, r, 3, '', hStyle(SLATE700))
      sc(ws, r, 4, '', hStyle(SLATE700))
      merge(ws, { r, c: 0 }, { r, c: 4 })
      r++

      sc(ws, r, 0, 'Etapa',          hStyle('334155', WHITE, true, 10))
      sc(ws, r, 1, 'Deals',          hStyle('334155', WHITE, true, 10))
      sc(ws, r, 2, '% del Total',    hStyle('334155', WHITE, true, 10))
      sc(ws, r, 3, '',               hStyle('334155'))
      sc(ws, r, 4, '',               hStyle('334155'))
      r++

      const totalForPct = allDeals.length || 1
      Object.entries(stageDist).sort((a,b) => b[1]-a[1]).forEach(([stage, count], i) => {
        const bg  = i % 2 === 0 ? WHITE : SLATE100
        const pct = Math.round((count / totalForPct) * 100)
        sc(ws, r, 0, stageLabel(stages, stage), dStyle(bg))
        sc(ws, r, 1, count, dStyle(bg, PURPLE, true, 'center'))
        sc(ws, r, 2, pct / 100, { ...pctStyle(bg), numFmt: '0%' })
        sc(ws, r, 3, '', dStyle(bg))
        sc(ws, r, 4, '', dStyle(bg))
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 4 } })
      XLSX.utils.book_append_sheet(wb, ws, '📊 Resumen')
    }

    // ────────────────────────────────────────────────────────────
    // HOJA 2: TODOS LOS DEALS
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [
        { wch: 26 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
        { wch: 20 }, { wch: 16 }, { wch: 8  }, { wch: 40 }, { wch: 14 },
      ]

      let r = 0

      // Título
      const HEADERS = ['Empresa','Industria','Etapa','Estado','Valor Estimado (CLP)','Responsable','Fuente','Score','Próxima Acción','Actualización']
      sc(ws, r, 0, '🗂️ TODOS LOS DEALS', hStyle(PURPLE, WHITE, true, 12))
      for (let c = 1; c < HEADERS.length; c++) sc(ws, r, c, '', hStyle(PURPLE))
      merge(ws, { r, c: 0 }, { r, c: HEADERS.length - 1 })
      r++

      // Encabezados columnas
      HEADERS.forEach((h, c) => sc(ws, r, c, h, hStyle(SLATE700, WHITE, true, 10)))
      r++

      allDeals.forEach((d: any, i: number) => {
        const bg = i % 2 === 0 ? WHITE : SLATE100
        const statusLabel = d.status === 'won' ? 'Ganado' : d.status === 'lost' ? 'Perdido' : 'Activo'
        const statusStyle = d.status === 'won'
          ? { ...dStyle(bg, GREEN, true, 'center' as const) }
          : d.status === 'lost'
            ? { ...dStyle(bg, RED, true, 'center' as const) }
            : { ...dStyle(bg, PURPLE, false, 'center' as const) }

        sc(ws, r, 0, d.companies?.name ?? '',                    dStyle(bg, DARK, true))
        sc(ws, r, 1, d.companies?.industry ?? '',                dStyle(bg))
        sc(ws, r, 2, stageLabel(stages, d.stage),               dStyle(bg))
        sc(ws, r, 3, statusLabel,                                statusStyle)
        sc(ws, r, 4, Number(d.estimated_value) || 0,            moneyStyle(bg))
        sc(ws, r, 5, d.profiles?.full_name ?? '',                dStyle(bg))
        sc(ws, r, 6, d.source ?? '',                             dStyle(bg, SLATE500))
        sc(ws, r, 7, d.score ?? 0,                              dStyle(bg, PURPLE, true, 'center'))
        sc(ws, r, 8, d.next_action ?? '',                        dStyle(bg, SLATE700))
        sc(ws, r, 9, d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '', dStyle(bg, SLATE500, false, 'center'))
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: HEADERS.length - 1 } })
      XLSX.utils.book_append_sheet(wb, ws, '🗂️ Todos los Deals')
    }

    // ────────────────────────────────────────────────────────────
    // HOJA 3: GANADOS & PERDIDOS
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 10 }]

      let r = 0

      // GANADOS
      sc(ws, r, 0, '🏆 DEALS GANADOS', hStyle('059669', WHITE, true, 12))
      for (let c = 1; c < 5; c++) sc(ws, r, c, '', hStyle('059669'))
      merge(ws, { r, c: 0 }, { r, c: 4 })
      r++

      sc(ws, r, 0, 'Empresa',        hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 1, 'Valor (CLP)',      hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 2, 'Responsable',    hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 3, 'Fecha de Cierre',hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 4, '',               hStyle(SLATE700))
      r++

      wonData.forEach((d: any, i: number) => {
        const bg = i % 2 === 0 ? WHITE : 'f0fdf4'
        sc(ws, r, 0, d.companies?.name ?? '', dStyle(bg, DARK, true))
        sc(ws, r, 1, Number(d.estimated_value) || 0, moneyStyle(bg))
        sc(ws, r, 2, d.profiles?.full_name ?? '', dStyle(bg))
        sc(ws, r, 3, d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '', dStyle(bg, SLATE500, false, 'center'))
        sc(ws, r, 4, '', dStyle(bg))
        r++
      })

      const totalWonRev = wonData.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0)
      sc(ws, r, 0, 'TOTAL', hStyle(GREEN))
      sc(ws, r, 1, totalWonRev, { ...moneyStyle(GREEN), font: { color: { rgb: WHITE }, sz: 11, bold: true }, alignment: { horizontal: 'right' } })
      sc(ws, r, 2, `${wonData.length} deals`, hStyle(GREEN))
      sc(ws, r, 3, '', hStyle(GREEN))
      sc(ws, r, 4, '', hStyle(GREEN))
      r++

      r++ // espacio

      // PERDIDOS
      sc(ws, r, 0, '❌ DEALS PERDIDOS', hStyle('dc2626', WHITE, true, 12))
      for (let c = 1; c < 5; c++) sc(ws, r, c, '', hStyle('dc2626'))
      merge(ws, { r, c: 0 }, { r, c: 4 })
      r++

      sc(ws, r, 0, 'Empresa',        hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 1, 'Valor (CLP)',      hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 2, 'Motivo',         hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 3, 'Fecha',          hStyle(SLATE700, WHITE, true, 10))
      sc(ws, r, 4, '',               hStyle(SLATE700))
      r++

      lostData.forEach((d: any, i: number) => {
        const bg = i % 2 === 0 ? WHITE : 'fff1f2'
        sc(ws, r, 0, d.companies?.name ?? '', dStyle(bg, DARK, true))
        sc(ws, r, 1, Number(d.estimated_value) || 0, moneyStyle(bg))
        sc(ws, r, 2, d.lost_reason ?? '', dStyle(bg, RED))
        sc(ws, r, 3, d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-CL') : '', dStyle(bg, SLATE500, false, 'center'))
        sc(ws, r, 4, '', dStyle(bg))
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 4 } })
      XLSX.utils.book_append_sheet(wb, ws, '🏆 Ganados & Perdidos')
    }

    // ────────────────────────────────────────────────────────────
    // HOJA 4: LEADERBOARD
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [{ wch: 5 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }]

      let r = 0

      sc(ws, r, 0, '🥇 LEADERBOARD DE EJECUTIVOS', hStyle(PURPLE, WHITE, true, 12))
      for (let c = 1; c < 7; c++) sc(ws, r, c, '', hStyle(PURPLE))
      merge(ws, { r, c: 0 }, { r, c: 6 })
      r++

      const LHEADERS = ['#', 'Ejecutivo', 'Revenue (CLP)', 'Ganados', 'Perdidos', 'En Curso', 'Win Rate']
      LHEADERS.forEach((h, c) => sc(ws, r, c, h, hStyle(SLATE700, WHITE, true, 10)))
      r++

      const medals = ['🥇', '🥈', '🥉']
      Object.values(execStats).sort((a,b) => b.revenue - a.revenue).forEach((exec, i) => {
        const total  = exec.won + exec.lost
        const wr     = total > 0 ? exec.won / total : 0
        const bg     = i === 0 ? 'fefce8' : i === 1 ? 'f8fafc' : i % 2 === 0 ? WHITE : SLATE100
        const medal  = medals[i] ?? `${i + 1}`
        sc(ws, r, 0, medal,     dStyle(bg, SLATE700, false, 'center'))
        sc(ws, r, 1, exec.name, dStyle(bg, DARK, i < 3))
        sc(ws, r, 2, exec.revenue, moneyStyle(bg))
        sc(ws, r, 3, exec.won,  dStyle(bg, GREEN, true, 'center'))
        sc(ws, r, 4, exec.lost, dStyle(bg, RED, true, 'center'))
        sc(ws, r, 5, exec.open, dStyle(bg, PURPLE, true, 'center'))
        sc(ws, r, 6, wr,        { ...pctStyle(bg), numFmt: '0%' })
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 6 } })
      XLSX.utils.book_append_sheet(wb, ws, '🥇 Leaderboard')
    }

    // ────────────────────────────────────────────────────────────
    // HOJA 5: TAREAS
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [{ wch: 40 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 12 }]

      let r = 0

      sc(ws, r, 0, '✅ TAREAS', hStyle(SLATE700, WHITE, true, 12))
      for (let c = 1; c < 5; c++) sc(ws, r, c, '', hStyle(SLATE700))
      merge(ws, { r, c: 0 }, { r, c: 4 })
      r++

      const THEADERS = ['Tarea', 'Empresa', 'Responsable', 'Vencimiento', 'Estado']
      THEADERS.forEach((h, c) => sc(ws, r, c, h, hStyle('334155', WHITE, true, 10)))
      r++

      tasksData.forEach((t: any, i: number) => {
        const isOverdue = !t.is_completed && t.due_date && new Date(t.due_date) < now
        const bg = t.is_completed ? 'f0fdf4' : isOverdue ? 'fff1f2' : i % 2 === 0 ? WHITE : SLATE100
        const statusLabel = t.is_completed ? '✅ Completada' : isOverdue ? '⏰ Vencida' : '🔵 Pendiente'
        const statusColor = t.is_completed ? GREEN : isOverdue ? RED : PURPLE

        sc(ws, r, 0, t.title,                                            dStyle(bg, DARK))
        sc(ws, r, 1, t.deals?.companies?.name ?? '',                     dStyle(bg, SLATE500))
        sc(ws, r, 2, t.profiles?.full_name ?? '',                        dStyle(bg))
        sc(ws, r, 3, t.due_date ? new Date(t.due_date).toLocaleDateString('es-CL') : '', dStyle(bg, SLATE500, false, 'center'))
        sc(ws, r, 4, statusLabel,                                        { ...dStyle(bg, statusColor, true, 'center') })
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 4 } })
      XLSX.utils.book_append_sheet(wb, ws, '✅ Tareas')
    }

    // ────────────────────────────────────────────────────────────
    // HOJA 6: EQUIPO
    // ────────────────────────────────────────────────────────────
    {
      const ws: Record<string, any> = {}
      ws['!cols'] = [{ wch: 26 }, { wch: 32 }, { wch: 22 }, { wch: 10 }]

      let r = 0

      sc(ws, r, 0, '👥 EQUIPO', hStyle(PURPLE, WHITE, true, 12))
      for (let c = 1; c < 4; c++) sc(ws, r, c, '', hStyle(PURPLE))
      merge(ws, { r, c: 0 }, { r, c: 3 })
      r++

      const EHEADERS = ['Nombre', 'Email', 'Rol', 'Estado']
      EHEADERS.forEach((h, c) => sc(ws, r, c, h, hStyle(SLATE700, WHITE, true, 10)))
      r++

      profilesData.forEach((p: any, i: number) => {
        const bg = i % 2 === 0 ? WHITE : SLATE100
        const rolColor = p.role === 'super_admin' || p.role === 'admin' ? PURPLE
                       : p.role === 'gerente' ? AMBER : SLATE700
        sc(ws, r, 0, p.full_name ?? '',                 dStyle(bg, DARK, true))
        sc(ws, r, 1, p.email ?? '',                     dStyle(bg, SLATE500))
        sc(ws, r, 2, ROLE_LABELS[p.role] ?? p.role,    { ...dStyle(bg, rolColor, true, 'center') })
        sc(ws, r, 3, p.is_active ? '✅ Activo' : '❌ Inactivo', dStyle(bg, p.is_active ? GREEN : RED, false, 'center'))
        r++
      })

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 3 } })
      XLSX.utils.book_append_sheet(wb, ws, '👥 Equipo')
    }

    // ── Generar buffer y responder ─────────────────────────────
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
    const filename = `reporte-crm-${now.toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('Export error:', err)
    return NextResponse.json({ error: err?.message ?? 'Error generando reporte' }, { status: 500 })
  }
}
