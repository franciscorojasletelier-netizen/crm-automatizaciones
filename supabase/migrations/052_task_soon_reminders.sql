-- 052 — Recordatorio por correo 5 minutos antes de cada tarea con hora
--
-- Además del resumen de la mañana (daily-tasks), cada tarea con hora
-- avisa a su responsable unos minutos antes. Las tareas "de todo el día"
-- (medianoche en Chile) no avisan.
--
-- reminder_sent_at marca el aviso enviado; si la tarea se reprograma, se
-- limpia y vuelve a avisar en el nuevo horario. La marca se toma de forma
-- atómica (UPDATE … RETURNING con SKIP LOCKED): aunque dos ejecuciones del
-- cron se crucen, cada aviso sale una sola vez.

alter table tasks add column if not exists reminder_sent_at timestamptz;

create or replace function tasks_reset_reminder() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.due_date is distinct from old.due_date then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_reset_reminder on tasks;
create trigger tasks_reset_reminder before update of due_date on tasks
  for each row execute function tasks_reset_reminder();

-- Toma (marca) los avisos que vencen dentro de p_minutes y los devuelve
-- con lo necesario para el correo. Solo para el cron (service_role).
create or replace function claim_task_reminders(p_minutes int default 5)
returns table (
  task_id uuid, title text, description text, due_date timestamptz, deal_id uuid,
  user_id uuid, email text, full_name text, org_name text, company_name text
)
language sql security definer set search_path = public as $$
  with due as (
    select t.id
      from tasks t
      join profiles p on p.id = coalesce(t.assigned_to, t.created_by)
     where not t.is_completed
       and t.reminder_sent_at is null
       and t.due_date > now()
       and t.due_date <= now() + make_interval(mins => p_minutes)
       and (t.due_date at time zone 'America/Santiago')::time <> time '00:00'
       and p.is_active and p.email is not null
     for update of t skip locked
  ), claimed as (
    update tasks t set reminder_sent_at = now()
      from due where t.id = due.id
    returning t.id, t.title, t.description, t.due_date, t.deal_id, t.organization_id,
              coalesce(t.assigned_to, t.created_by) as uid
  )
  select c.id, c.title, c.description, c.due_date, c.deal_id,
         p.id, p.email, p.full_name,
         coalesce(o.display_name, o.name), co.name
    from claimed c
    join profiles p on p.id = c.uid
    left join organizations o on o.id = c.organization_id
    left join deals d on d.id = c.deal_id
    left join companies co on co.id = d.company_id
   where coalesce(o.is_active, true)
$$;

-- Si el correo falla, el cron devuelve la marca para reintentar al minuto siguiente.
create or replace function release_task_reminder(p_task_id uuid) returns void
language sql security definer set search_path = public as $$
  update tasks set reminder_sent_at = null where id = p_task_id
$$;

revoke all on function claim_task_reminders(int), release_task_reminder(uuid), tasks_reset_reminder() from public, anon, authenticated;
grant execute on function claim_task_reminders(int), release_task_reminder(uuid) to service_role;
