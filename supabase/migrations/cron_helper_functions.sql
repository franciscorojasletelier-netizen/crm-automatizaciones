-- ════════════════════════════════════════════════════════════════
--  FUNCIONES HELPER PARA CRON — Ejecutar en Supabase → SQL Editor
--  Permiten al cron leer datos sin ser bloqueado por RLS
-- ════════════════════════════════════════════════════════════════

-- 1. Todos los perfiles activos (para el cron de daily-tasks)
create or replace function get_all_profiles_for_cron()
returns table(id uuid, full_name text, email text, is_active boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, u.email::text, p.is_active
  from profiles p
  join auth.users u on u.id = p.id
  where p.is_active = true
$$;

grant execute on function get_all_profiles_for_cron() to service_role;

-- 2. Tareas próximas de un usuario (hoy + mañana)
create or replace function get_tasks_for_cron(
  p_user_id uuid,
  p_from    timestamptz,
  p_to      timestamptz
)
returns table(
  id         uuid,
  title      text,
  due_date   timestamptz,
  is_completed boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.title, t.due_date, t.is_completed
  from tasks t
  where t.assigned_to = p_user_id
    and t.is_completed = false
    and t.due_date >= p_from
    and t.due_date <  p_to
  order by t.due_date asc
  limit 20
$$;

grant execute on function get_tasks_for_cron(uuid, timestamptz, timestamptz) to service_role;

-- 3. Tareas vencidas de un usuario
create or replace function get_overdue_tasks_for_cron(
  p_user_id uuid,
  p_before  timestamptz
)
returns table(
  id         uuid,
  title      text,
  due_date   timestamptz,
  is_completed boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.title, t.due_date, t.is_completed
  from tasks t
  where t.assigned_to = p_user_id
    and t.is_completed = false
    and t.due_date < p_before
  order by t.due_date asc
  limit 20
$$;

grant execute on function get_overdue_tasks_for_cron(uuid, timestamptz) to service_role;
