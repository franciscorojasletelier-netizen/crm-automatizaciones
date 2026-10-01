-- ============================================================
--  042 — Vencimientos de servicios (panel de plataforma)
--
--  * email_accounts.connected_at: cuándo se dio el consentimiento OAuth.
--    Google revoca el acceso a los 7 días si la app OAuth está en modo
--    "Testing"; updated_at no sirve porque cambia en cada renovación.
--  * service_reminders: vencimientos que el sistema no puede leer solo
--    (token de Supabase, dominio, planes). Solo dueños de la plataforma.
--  * platform_service_health(): salud de los procesos automáticos y
--    última actividad, para estimar la pausa por inactividad de Supabase.
-- ============================================================

alter table email_accounts add column if not exists connected_at timestamptz;
update email_accounts set connected_at = coalesce(connected_at, created_at);
alter table email_accounts alter column connected_at set default now();
alter table email_accounts alter column connected_at set not null;

create table if not exists service_reminders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  category    text not null default 'otro'
              check (category in ('token', 'dominio', 'plan', 'certificado', 'otro')),
  expires_on  date,
  url         text check (url is null or url ~* '^https?://'),
  notes       text check (notes is null or length(notes) <= 1000),
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table service_reminders enable row level security;

drop policy if exists service_reminders_owner_all on service_reminders;
create policy service_reminders_owner_all on service_reminders
  for all to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

revoke all on service_reminders from anon;
-- Las tablas nuevas no heredan privilegios: la RLS de arriba es la barrera.
grant select, insert, update, delete on service_reminders to authenticated;

-- Salud de la plataforma: solo para dueños (lee cron y pg_net, que no
-- están expuestos por la API).
create or replace function platform_service_health()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
begin
  if not is_platform_owner() then
    raise exception 'Solo el dueño de la plataforma' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'now', now(),
    'cron', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_run', r.start_time, 'last_status', r.status
      ) order by j.jobname)
      from cron.job j
      left join lateral (
        select d.start_time, d.status from cron.job_run_details d
        where d.jobid = j.jobid order by d.start_time desc limit 1
      ) r on true
    ), '[]'::jsonb),
    'http_24h', (
      select jsonb_build_object(
        'ok',    count(*) filter (where status_code between 200 and 299),
        'error', count(*) filter (where status_code >= 300),
        'sin_respuesta', count(*) filter (where status_code is null),
        'ultima_ok', max(created) filter (where status_code between 200 and 299)
      )
      from net._http_response where created > now() - interval '24 hours'
    ),
    'last_user_activity', (select max(last_seen_at) from user_sessions)
  ) into result;

  return result;
end;
$$;

revoke all on function platform_service_health() from public, anon;
grant execute on function platform_service_health() to authenticated;

-- Recordatorio inicial: el token personal de Supabase (lo usa Claude por
-- MCP) tiene la fecha de vencimiento que se eligió al crearlo.
insert into service_reminders (name, category, url, notes)
select 'Token de acceso de Supabase (MCP de Claude)', 'token',
       'https://supabase.com/dashboard/account/tokens',
       'Revisa la columna "Expires" en la página de tokens y anota la fecha aquí.'
where not exists (select 1 from service_reminders where category = 'token' and name ilike '%supabase%');
