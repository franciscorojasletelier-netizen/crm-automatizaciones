-- ============================================================
--  037 — Cerrar funciones SECURITY DEFINER expuestas por la API.
--
--  Postgres da EXECUTE a PUBLIC en toda función nueva, y Supabase
--  publica las funciones de `public` en /rest/v1/rpc/*. Varias funciones
--  SECURITY DEFINER (que saltan RLS) quedaron invocables por `anon` —
--  es decir, por cualquiera que tenga la clave publicable, que va en el
--  JS del navegador:
--
--  * get_all_profiles_for_cron() devolvía nombre y email de TODOS los
--    usuarios de TODAS las organizaciones sin iniciar sesión.
--  * get_tasks_for_cron / get_overdue_tasks_for_cron devolvían las
--    tareas de cualquier usuario conociendo su id.
--
--  Reglas que aplica esta migración:
--  1. Funciones de cron → solo service_role (las rutas /api/cron usan
--     SUPABASE_SECRET_KEY).
--  2. Funciones de trigger → nadie. Postgres solo exige EXECUTE al crear
--     el trigger, no al dispararlo: los triggers siguen funcionando.
--  3. Acciones invocadas desde la app con sesión (validan permisos por
--     dentro) → authenticated, pero no anon.
--  4. Ayudantes usados dentro de políticas RLS (current_org_id,
--     current_user_role, is_manager, is_platform_owner, can_see_deal) NO
--     se tocan: las políticas se evalúan con el rol del usuario y
--     necesitan EXECUTE. No exponen datos de otras organizaciones.
--
--  Idempotente.
-- ============================================================

begin;

-- 1. Cron: solo el servidor
revoke all on function get_all_profiles_for_cron()                                   from public, anon, authenticated;
revoke all on function get_tasks_for_cron(uuid, timestamptz, timestamptz)            from public, anon, authenticated;
revoke all on function get_overdue_tasks_for_cron(uuid, timestamptz)                 from public, anon, authenticated;
grant execute on function get_all_profiles_for_cron()                                to service_role;
grant execute on function get_tasks_for_cron(uuid, timestamptz, timestamptz)         to service_role;
grant execute on function get_overdue_tasks_for_cron(uuid, timestamptz)              to service_role;

-- 2. Funciones de trigger y event trigger del esquema public: nadie las
--    llama directo. Se recorren dinámicamente para no olvidar ninguna.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end;
$$;

-- 3. Acciones con validación interna: solo usuarios con sesión
revoke all on function create_pipeline(uuid, text)      from public, anon;
revoke all on function set_default_stage(uuid, uuid)    from public, anon;
revoke all on function set_won_stage(uuid, uuid)        from public, anon;
revoke all on function soft_delete_deal(uuid)           from public, anon;
grant execute on function create_pipeline(uuid, text)   to authenticated, service_role;
grant execute on function set_default_stage(uuid, uuid) to authenticated, service_role;
grant execute on function set_won_stage(uuid, uuid)     to authenticated, service_role;
grant execute on function soft_delete_deal(uuid)        to authenticated, service_role;

commit;
