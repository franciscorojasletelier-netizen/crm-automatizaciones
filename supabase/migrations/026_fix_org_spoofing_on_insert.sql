-- ============================================================
--  FASE 7 — CRÍTICO: un usuario autenticado podía declarar la
--  organización de OTRA empresa al crear una fila.
--
--  `companies_insert`, `contacts_insert` y `deals_insert`
--  (010_multi_tenant_foundation.sql / security_hardening.sql) solo
--  exigen `auth.uid() is not null` — nunca validan `organization_id`
--  en el WITH CHECK. Y el trigger genérico `set_org_from_user()`
--  solo rellena `organization_id` cuando viene NULL:
--
--    if new.organization_id is not null then return new; end if;
--
--  Es decir: un usuario autenticado (cualquier rol, sin necesitar
--  ser manager) podía hacer, con su propia sesión, algo como
--  `supabase.from('companies').insert({ name: 'x', organization_id:
--  '<uuid de otra empresa>' })` y la fila quedaba creada en la
--  organización ajena — la app nunca hace esto porque siempre omite
--  `organization_id` en sus propios inserts, pero RLS no puede
--  depender de que el cliente "se porte bien": es la garantía que
--  tiene que dar la base.
--
--  Fix: si hay una sesión de usuario real (auth.uid() no nulo), la
--  organización SIEMPRE se pisa con la de la sesión, sin importar lo
--  que venga en el insert. Solo cuando NO hay sesión (service_role,
--  usado por webhooks/crons) se respeta el valor ya resuelto por el
--  caller — ahí no hay otra fuente de la que derivarlo.
--
--  Esta función la usan `companies`, `contacts`, `deals`, `areas`,
--  `direct_messages`, `user_activity_log`, `user_sessions` y
--  `audit_log` — el fix cierra el mismo agujero en las ocho de una,
--  no solo en las tres donde se detectó.
-- ============================================================

begin;

create or replace function set_org_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.organization_id := current_org_id();
    return new;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id(); -- service_role sin org resuelta: queda null, falla por NOT NULL/FK si la tabla lo exige
  end if;
  return new;
end;
$$;

commit;
