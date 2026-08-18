-- ============================================================
--  FASE 9.0 — Migrar los cron jobs de Vercel a pg_cron.
--
--  El plan Hobby de Vercel limita los cron a UNA ejecución diaria.
--  Las secuencias de follow-up (Fase 8.1) y las automatizaciones
--  "días sin actividad" corrían una vez al día por esa limitación,
--  no por diseño: un paso configurado "a las 48 horas" podía
--  dispararse con hasta 24 horas de atraso. pg_cron viene habilitado
--  en todos los proyectos Supabase (incluido el free tier) y no tiene
--  ese techo — se agenda con la granularidad que corresponde.
--
--  El secreto del cron y la URL base NO se guardan en el cuerpo del
--  job (`cron.job.command` es legible por cualquiera con acceso a esa
--  tabla): se guardan en Supabase Vault, y una función SECURITY
--  DEFINER es la única que los lee.
-- ============================================================

begin;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Placeholders — hay que reemplazarlos por los valores reales después
-- de correr esta migración (ver instrucciones al final del archivo).
-- vault.secrets es una vista con triggers que cifran vía pgsodium;
-- un INSERT directo falla por permisos — hay que pasar por la función
-- helper vault.create_secret(), que sí tiene el privilegio necesario.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret('REEMPLAZAR', 'cron_secret', 'Bearer token para /api/cron/* — debe ser igual a CRON_SECRET en Vercel');
  end if;
  if not exists (select 1 from vault.secrets where name = 'app_base_url') then
    perform vault.create_secret('https://crm-automatizaciones.vercel.app', 'app_base_url', 'URL base de la app para las llamadas de pg_cron');
  end if;
end;
$$;

-- Única función que puede leer los secretos y disparar la llamada.
-- Nunca lanza excepción por un fallo de red/HTTP: un cron que falla
-- una vez no debe tumbar el scheduler ni dejar el job "roto".
create or replace function cron_call(p_path text)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_base_url text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url';

  if v_secret is null or v_secret = 'REEMPLAZAR' or v_base_url is null then
    raise warning 'cron_call: cron_secret / app_base_url sin configurar en vault.secrets — job % omitido', p_path;
    return;
  end if;

  begin
    select net.http_post(
      url := v_base_url || p_path,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
      body := '{}'::jsonb
    ) into v_request_id;
  exception when others then
    raise warning 'cron_call: fallo al invocar % — %', p_path, sqlerrm;
  end;
end;
$$;

revoke all on function cron_call(text) from public;
grant execute on function cron_call(text) to postgres;

-- cron.schedule() con un jobname ya usado actualiza ese job en vez de
-- duplicarlo (re-correr esta migración es seguro).
select cron.schedule('cron-sequences',     '*/15 * * * *', $$select cron_call('/api/cron/sequences')$$);
select cron.schedule('cron-automations',   '*/15 * * * *', $$select cron_call('/api/cron/automations')$$);
select cron.schedule('cron-daily-tasks',   '0 11 * * *',   $$select cron_call('/api/cron/daily-tasks')$$);
select cron.schedule('cron-task-reminders','0 12 * * *',   $$select cron_call('/api/cron/task-reminders')$$);

commit;

-- ============================================================
--  DESPUÉS de correr esta migración, actualizar el secreto real
--  (el mismo valor que CRON_SECRET en las variables de entorno de
--  Vercel) con esta sentencia — NO commitear el valor real a git.
--  Igual que el insert, el UPDATE directo sobre vault.secrets falla
--  por permisos: hay que usar vault.update_secret().
--
--  select vault.update_secret(id, 'el-valor-real-de-CRON_SECRET')
--    from vault.secrets where name = 'cron_secret';
--
--  Si la URL de producción cambia alguna vez:
--
--  select vault.update_secret(id, 'https://nueva-url.vercel.app')
--    from vault.secrets where name = 'app_base_url';
-- ============================================================
