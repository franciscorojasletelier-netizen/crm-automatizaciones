-- ============================================================
--  036 — Arreglo: crear organizaciones volvió a fallar desde la 031.
--
--  La 031 dejó pipeline_stages.pipeline_id como NOT NULL, pero
--  seed_default_stages() (migración 015) sigue insertando las etapas
--  sin pipeline_id. Resultado: /api/platform/create-organization
--  revienta con "null value in column pipeline_id ... violates
--  not-null constraint", hace rollback y la organización nunca se
--  crea. Lo mismo rompía el setup de scripts/test-rls-isolation.mjs.
--
--  Arreglo: un trigger BEFORE INSERT que, si una etapa llega sin
--  pipeline_id, la asigna al pipeline por defecto de su organización,
--  creándolo ("Pipeline principal", igual que el backfill de la 031)
--  si la organización todavía no tiene ninguno. Así seed_default_stages
--  sigue funcionando sin duplicar su lista de etapas acá. Las etapas
--  que ya traen pipeline_id (panel de plataforma, create_pipeline) no
--  se tocan.
--
--  Además: seed_default_stages/seed_default_modules son SECURITY
--  DEFINER y nunca se les quitó el EXECUTE por defecto de PUBLIC, así
--  que cualquier usuario logueado podía llamarlas por RPC sobre
--  cualquier organización. Solo las usa el servidor con service_role.
--
--  Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================

begin;

create or replace function set_stage_pipeline_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pipeline_id is not null then
    return new;
  end if;

  select id into new.pipeline_id
    from pipelines
   where organization_id = new.organization_id and is_default and is_active
   limit 1;

  if new.pipeline_id is null then
    insert into pipelines (organization_id, name, is_default, sort_order)
    values (new.organization_id, 'Pipeline principal', true, 1)
    returning id into new.pipeline_id;
  end if;

  return new;
end;
$$;

revoke all on function set_stage_pipeline_on_insert() from public, anon, authenticated;

drop trigger if exists trg_stage_pipeline_on_insert on pipeline_stages;
create trigger trg_stage_pipeline_on_insert
  before insert on pipeline_stages
  for each row execute function set_stage_pipeline_on_insert();

revoke all on function seed_default_stages(uuid)  from public, anon, authenticated;
revoke all on function seed_default_modules(uuid) from public, anon, authenticated;
grant execute on function seed_default_stages(uuid)  to service_role;
grant execute on function seed_default_modules(uuid) to service_role;

commit;
