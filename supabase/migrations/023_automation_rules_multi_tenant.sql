-- ============================================================
--  FASE 3.1 — Corrección: `automation_rules` y `automation_logs`
--  nunca existieron en producción (add_features_v2.sql se aplicó
--  solo hasta crear `notifications`; el resto del archivo — las dos
--  tablas de automatizaciones y sus policies — nunca se ejecutó).
--  Es decir: TODO el módulo de Automatizaciones estuvo devolviendo
--  error silencioso desde siempre (el código ya atrapa el error y
--  no bloquea el flujo principal), no solo el trigger "días sin
--  actividad" que se reportó primero.
--
--  Esta migración crea las tablas YA con organization_id desde el
--  origen — evita el problema de la migración 023 anterior, que
--  asumía que las tablas ya existían sin esa columna.
-- ============================================================

begin;

create table if not exists automation_rules (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  name             text        not null,
  description      text,
  trigger_type     text        not null,
  trigger_config   jsonb       not null default '{}',
  action_type      text        not null,
  action_config    jsonb       not null default '{}',
  is_active        boolean     not null default true,
  run_count        integer     not null default 0,
  last_run_at      timestamptz,
  created_by       uuid        references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists automation_logs (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  rule_id          uuid        references automation_rules(id) on delete set null,
  rule_name        text,
  entity_type      text,
  entity_id        uuid,
  status           text        not null default 'success',
  details          jsonb,
  executed_at      timestamptz not null default now()
);

create index if not exists idx_automation_rules_org on automation_rules(organization_id);
create index if not exists idx_automation_logs_org   on automation_logs(organization_id);

alter table automation_rules enable row level security;
alter table automation_logs  enable row level security;

-- La organización se toma del usuario que inserta si no viene explícita
-- (mismo patrón que deals/companies/contacts).
create or replace function set_org_automation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_org_automation_rules on automation_rules;
create trigger trg_org_automation_rules before insert on automation_rules
  for each row execute function set_org_automation_rules();

create or replace function set_org_automation_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null and new.rule_id is not null then
    select organization_id into new.organization_id from automation_rules where id = new.rule_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_org_automation_logs on automation_logs;
create trigger trg_org_automation_logs before insert on automation_logs
  for each row execute function set_org_automation_logs();

create policy "automation_rules_manage" on automation_rules
  for all using (
    organization_id = current_org_id() and is_manager()
  ) with check (
    organization_id = current_org_id() and is_manager()
  );

create policy "automation_rules_read_active" on automation_rules
  for select using (
    organization_id = current_org_id() and is_active = true
  );

create policy "automation_logs_manage" on automation_logs
  for select using (
    organization_id = current_org_id() and is_manager()
  );

create policy "automation_logs_insert" on automation_logs
  for insert with check (
    organization_id = current_org_id() and auth.uid() is not null
  );

grant select, insert, update, delete on automation_rules to authenticated;
grant select, insert            on automation_logs  to authenticated;

commit;
