-- ============================================================
--  FASE 7 — corrige una regresión introducida por la migración 026.
--
--  026 hacía: "si auth.uid() no es null, pisar organization_id con
--  current_org_id(), sin importar lo que declare el insert" — para
--  cerrar el agujero de spoofing cross-tenant.
--
--  Pero para llamadas con la service_role key (webhooks, crons, y el
--  script de test), auth.uid() NO está devolviendo null como se
--  esperaba (con el formato nuevo de API keys de Supabase,
--  sb_secret_*, la resolución de auth.uid()/auth.role() no se
--  comporta igual que con las claves JWT legacy). Resultado real:
--  el trigger pisaba organization_id con current_org_id() — que
--  para una llamada sin sesión de usuario da NULL — y reventaba el
--  NOT NULL constraint de companies/contacts/deals en cualquier
--  insert de service_role que declarara su organización a mano
--  (exactamente lo que hacen los webhooks).
--
--  Fix: usar auth.role() = 'service_role' para detectar la llamada
--  de service_role de forma explícita, en vez de inferirlo de
--  auth.uid(). auth.role() ya se usa en otras policies de este
--  proyecto (003_fix_rls_select_policies.sql) y es el mecanismo
--  estándar de Supabase para esto.
-- ============================================================

begin;

create or replace function set_org_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    if new.organization_id is null then
      new.organization_id := current_org_id();
    end if;
    return new;
  end if;

  -- Sesión de usuario real (anon/authenticated): la organización
  -- SIEMPRE es la de la sesión, nunca la que declare el insert.
  new.organization_id := current_org_id();
  return new;
end;
$$;

commit;
