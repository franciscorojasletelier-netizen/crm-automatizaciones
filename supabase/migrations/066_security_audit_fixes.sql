-- ============================================================
--  066 · Correcciones de la auditoría de seguridad (11-11-2026)
--
--  1. platform_integrations.access_token (token permanente de Meta y
--     WhatsApp, client_secret de Google/Microsoft, secreto del formulario
--     web) lo podía leer CUALQUIER usuario de la organización por la API:
--     la policy de SELECT incluye a toda la organización y `authenticated`
--     tenía SELECT sobre todas las columnas. Ahora esa columna solo la lee
--     service_role (el servidor, después de verificar permisos).
--
--  2. Altas de empresas, contactos y negocios sin validar la organización:
--     el trigger set_org_from_user solo completa organization_id cuando
--     viene nulo, y la policy de INSERT solo pedía sesión. Un usuario podía
--     insertar filas en OTRA organización enviando su id.
--
--  3. user_activity_log: cualquiera con sesión podía registrar actividad a
--     nombre de otro usuario u otra organización.
-- ============================================================

begin;

-- 1 ─ Secretos de integraciones ────────────────────────────────
revoke select on platform_integrations from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'platform_integrations'
     and column_name <> 'access_token';
  execute format('grant select (%s) on platform_integrations to authenticated', cols);
end $$;

-- 2 ─ Altas siempre en la organización propia ─────────────────
drop policy if exists "companies_insert" on companies;
create policy "companies_insert" on companies for insert
  with check ((select auth.uid()) is not null and organization_id = current_org_id());

drop policy if exists "contacts_insert" on contacts;
create policy "contacts_insert" on contacts for insert
  with check ((select auth.uid()) is not null and organization_id = current_org_id());

drop policy if exists "deals_insert" on deals;
create policy "deals_insert" on deals for insert
  with check (
    (select auth.uid()) is not null
    and organization_id = current_org_id()
    and (owner_id = (select auth.uid()) or is_manager())
  );

-- 3 ─ Registro de actividad: solo a nombre propio ─────────────
drop policy if exists "user_activity_log_insert" on user_activity_log;
create policy "user_activity_log_insert" on user_activity_log for insert
  with check (user_id = (select auth.uid()) and organization_id = current_org_id());

commit;
