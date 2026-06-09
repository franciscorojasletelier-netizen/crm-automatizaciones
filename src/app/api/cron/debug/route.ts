import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendKey   = process.env.RESEND_API_KEY

  const supabase = createClient(supabaseUrl, supabaseKey)

  const now         = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString()

  // 1. Listar usuarios auth
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 200 })

  // 2. Perfiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, full_name, email, is_active')

  // 3. Tareas — sin filtro de usuario para ver si hay algo
  const { data: allTasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, due_date, is_completed')
    .eq('is_completed', false)
    .limit(20)

  // 4. Tareas en rango de fechas
  const { data: rangeTasks, error: rangeErr } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, due_date')
    .eq('is_completed', false)
    .gte('due_date', todayStart)
    .lt('due_date', tomorrowEnd)

  // 5. Tareas vencidas
  const { data: overdueTasks, error: overdueErr } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, due_date')
    .eq('is_completed', false)
    .lt('due_date', todayStart)

  return NextResponse.json({
    now,
    todayStart,
    tomorrowEnd,
    resendKeySet: !!resendKey,
    auth: {
      count: authData?.users?.length ?? 0,
      error: authErr?.message,
      users: authData?.users?.map(u => ({ id: u.id, email: u.email })) ?? [],
    },
    profiles: {
      count: profiles?.length ?? 0,
      error: profErr?.message,
      rows: profiles ?? [],
    },
    allTasks: {
      count: allTasks?.length ?? 0,
      error: tasksErr?.message,
      rows: allTasks ?? [],
    },
    rangeTasks: {
      count: rangeTasks?.length ?? 0,
      error: rangeErr?.message,
      rows: rangeTasks ?? [],
    },
    overdueTasks: {
      count: overdueTasks?.length ?? 0,
      error: overdueErr?.message,
      rows: overdueTasks ?? [],
    },
  })
}
