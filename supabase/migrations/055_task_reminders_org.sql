-- 055 — claim_task_reminders también devuelve la organización (logo y
-- datos de contacto en el correo del aviso). Cambia el tipo de retorno:
-- se recrea con los mismos permisos (solo service_role).
drop function if exists claim_task_reminders(int);
create function claim_task_reminders(p_minutes int default 5)
returns table (
  task_id uuid, title text, description text, due_date timestamptz, deal_id uuid,
  user_id uuid, email text, full_name text, organization_id uuid, company_name text
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
         p.id, p.email, p.full_name, c.organization_id, co.name
    from claimed c
    join profiles p on p.id = c.uid
    left join organizations o on o.id = c.organization_id
    left join deals d on d.id = c.deal_id
    left join companies co on co.id = d.company_id
   where coalesce(o.is_active, true)
$$;
revoke all on function claim_task_reminders(int) from public, anon, authenticated;
grant execute on function claim_task_reminders(int) to service_role;
