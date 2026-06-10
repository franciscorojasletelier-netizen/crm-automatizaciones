// Endpoint TEMPORAL de diagnóstico de notificaciones — eliminar tras usar
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const now   = new Date()
  const today = now.toISOString().split('T')[0]

  const [overdueRes, todayNotifsRes, allNotifsRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, due_date, assigned_to')
      .eq('assigned_to', user.id)
      .eq('is_completed', false)
      .lt('due_date', now.toISOString()),
    supabase.from('notifications')
      .select('entity_id, type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', today),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  // Probar un insert real
  const { data: testInsert, error: insertErr } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'automation',
      title: '🧪 Notificación de prueba (debug)',
      body: 'Si ves esto, el insert funciona',
      entity_type: 'deal',
      entity_id: null,
    })
    .select('id')
    .single()

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    overdueTasks: {
      count: overdueRes.data?.length ?? 0,
      error: overdueRes.error?.message ?? null,
      rows: overdueRes.data?.slice(0, 5) ?? [],
    },
    todayNotifs: {
      count: todayNotifsRes.data?.length ?? 0,
      error: todayNotifsRes.error?.message ?? null,
    },
    totalNotifs: {
      count: allNotifsRes.count ?? 0,
      error: allNotifsRes.error?.message ?? null,
    },
    testInsert: {
      ok: !!testInsert,
      id: testInsert?.id ?? null,
      error: insertErr?.message ?? null,
    },
  })
}
