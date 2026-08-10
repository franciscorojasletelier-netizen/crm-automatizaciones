-- ════════════════════════════════════════════════════════════════
--  FUNDACIÓN MULTI-TENANT — aísla el CRM por organización/empresa
--  Cada tabla de negocio queda particionada por organization_id.
--  El aislamiento se garantiza por RLS (Postgres), no por el código
--  de la app — así ningún call site de src/ puede filtrarse entre
--  organizaciones aunque se olvide un filtro.
--
--  ⚠️ Revisar política por política contra el CRM real antes de
--  ejecutar en producción. Ejecutar completo, de una sola vez,
--  en Supabase → SQL Editor. Es transaccional: si algo falla a
--  mitad de camino, no queda nada aplicado.
--
--  Antes de ejecutar: confirmar que el proyecto de Supabase tiene
--  PITR habilitado, o tomar un respaldo manual.
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- 0. TABLAS RAÍZ: organizations + platform_owners
-- ────────────────────────────────────────────────────────────────

create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Usuarios que administran la plataforma completa (no una organización
-- particular). Hoy solo el dueño. Gatea la creación de organizaciones
-- nuevas — un super_admin normal de un cliente NO debe poder crear
-- organizaciones ajenas.
create table if not exists platform_owners (
  user_id uuid primary key references profiles(id) on delete cascade
);

alter table organizations   enable row level security;
alter table platform_owners enable row level security;

-- ────────────────────────────────────────────────────────────────
-- 1. RENOMBRAR workspace_id → organization_id
--    (ya existe, sin usar, en estas 9 tablas desde 001_initial_schema.sql)
-- ────────────────────────────────────────────────────────────────

alter table profiles          rename column workspace_id to organization_id;
alter table companies         rename column workspace_id to organization_id;
alter table contacts          rename column workspace_id to organization_id;
alter table deals             rename column workspace_id to organization_id;
alter table interactions      rename column workspace_id to organization_id;
alter table tasks             rename column workspace_id to organization_id;
alter table user_activity_log rename column workspace_id to organization_id;
alter table user_sessions     rename column workspace_id to organization_id;
alter table audit_log         rename column workspace_id to organization_id;

alter table profiles          add constraint profiles_org_fk          foreign key (organization_id) references organizations(id);
alter table companies         add constraint companies_org_fk         foreign key (organization_id) references organizations(id);
alter table contacts          add constraint contacts_org_fk          foreign key (organization_id) references organizations(id);
alter table deals             add constraint deals_org_fk             foreign key (organization_id) references organizations(id);
alter table interactions      add constraint interactions_org_fk      foreign key (organization_id) references organizations(id);
alter table tasks             add constraint tasks_org_fk             foreign key (organization_id) references organizations(id);
alter table user_activity_log add constraint user_activity_log_org_fk foreign key (organization_id) references organizations(id);
alter table user_sessions     add constraint user_sessions_org_fk     foreign key (organization_id) references organizations(id);
alter table audit_log         add constraint audit_log_org_fk         foreign key (organization_id) references organizations(id);

-- ────────────────────────────────────────────────────────────────
-- 2. AGREGAR organization_id a las tablas que aún no la tienen
-- ────────────────────────────────────────────────────────────────

alter table pipeline_stage_history add column if not exists organization_id uuid references organizations(id);
alter table projects               add column if not exists organization_id uuid references organizations(id);
alter table project_deliverables   add column if not exists organization_id uuid references organizations(id);
alter table project_notes          add column if not exists organization_id uuid references organizations(id);
alter table deal_ai_insights       add column if not exists organization_id uuid references organizations(id);
alter table notifications          add column if not exists organization_id uuid references organizations(id);
alter table automation_rules       add column if not exists organization_id uuid references organizations(id);
alter table automation_logs        add column if not exists organization_id uuid references organizations(id);
alter table areas                  add column if not exists organization_id uuid references organizations(id);
alter table direct_messages        add column if not exists organization_id uuid references organizations(id);
alter table team_messages          add column if not exists organization_id uuid references organizations(id);
alter table deal_members           add column if not exists organization_id uuid references organizations(id);
alter table project_members        add column if not exists organization_id uuid references organizations(id);
alter table task_history           add column if not exists organization_id uuid references organizations(id);
alter table whatsapp_messages      add column if not exists organization_id uuid references organizations(id);

-- ────────────────────────────────────────────────────────────────
-- 3. BOOTSTRAP: crear la organización actual y backfillear
--    TODAS las filas existentes (hoy son de un solo cliente real)
-- ────────────────────────────────────────────────────────────────

do $$
declare
  v_org_id uuid;
begin
  insert into organizations (name) values ('Autopilot SpA') returning id into v_org_id;

  update profiles          set organization_id = v_org_id where organization_id is null;
  update companies         set organization_id = v_org_id where organization_id is null;
  update contacts          set organization_id = v_org_id where organization_id is null;
  update deals             set organization_id = v_org_id where organization_id is null;
  update interactions      set organization_id = v_org_id where organization_id is null;
  update tasks             set organization_id = v_org_id where organization_id is null;
  update user_activity_log set organization_id = v_org_id where organization_id is null;
  update user_sessions     set organization_id = v_org_id where organization_id is null;
  update audit_log         set organization_id = v_org_id where organization_id is null;

  update pipeline_stage_history set organization_id = v_org_id where organization_id is null;
  update projects                set organization_id = v_org_id where organization_id is null;
  update project_deliverables    set organization_id = v_org_id where organization_id is null;
  update project_notes           set organization_id = v_org_id where organization_id is null;
  update deal_ai_insights        set organization_id = v_org_id where organization_id is null;
  update notifications           set organization_id = v_org_id where organization_id is null;
  update automation_rules        set organization_id = v_org_id where organization_id is null;
  update automation_logs         set organization_id = v_org_id where organization_id is null;
  update areas                   set organization_id = v_org_id where organization_id is null;
  update direct_messages         set organization_id = v_org_id where organization_id is null;
  update team_messages           set organization_id = v_org_id where organization_id is null;
  update deal_members            set organization_id = v_org_id where organization_id is null;
  update project_members         set organization_id = v_org_id where organization_id is null;
  update task_history            set organization_id = v_org_id where organization_id is null;
  update whatsapp_messages       set organization_id = v_org_id where organization_id is null;

  -- Dueño de la plataforma (el único hoy)
  insert into platform_owners (user_id)
    select id from profiles where email = 'autopilotspa@gmail.com'
    on conflict do nothing;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 4. NOT NULL una vez backfilleadas (deals/companies/etc. no
--    necesitan sobrevivir "huérfanas" de organización nunca)
-- ────────────────────────────────────────────────────────────────

alter table profiles               alter column organization_id set not null;
alter table companies              alter column organization_id set not null;
alter table contacts               alter column organization_id set not null;
alter table deals                  alter column organization_id set not null;
alter table interactions           alter column organization_id set not null;
alter table tasks                  alter column organization_id set not null;
alter table user_activity_log      alter column organization_id set not null;
alter table user_sessions          alter column organization_id set not null;
alter table audit_log              alter column organization_id set not null;
alter table pipeline_stage_history alter column organization_id set not null;
alter table projects               alter column organization_id set not null;
alter table project_deliverables   alter column organization_id set not null;
alter table project_notes          alter column organization_id set not null;
alter table deal_ai_insights       alter column organization_id set not null;
alter table notifications          alter column organization_id set not null;
alter table automation_rules       alter column organization_id set not null;
alter table automation_logs        alter column organization_id set not null;
alter table areas                  alter column organization_id set not null;
alter table direct_messages        alter column organization_id set not null;
alter table team_messages          alter column organization_id set not null;
alter table deal_members           alter column organization_id set not null;
alter table project_members        alter column organization_id set not null;
alter table task_history           alter column organization_id set not null;
alter table whatsapp_messages      alter column organization_id set not null;

-- ────────────────────────────────────────────────────────────────
-- 5. ÍNDICES — sin esto, cada query filtrada por RLS termina en
--    sequential scan al crecer la base con varias organizaciones
-- ────────────────────────────────────────────────────────────────

create index if not exists idx_profiles_org          on profiles(organization_id);
create index if not exists idx_companies_org          on companies(organization_id);
create index if not exists idx_contacts_org           on contacts(organization_id, company_id);
create index if not exists idx_deals_org              on deals(organization_id);
create index if not exists idx_deals_org_stage        on deals(organization_id, stage);
create index if not exists idx_deals_org_owner        on deals(organization_id, owner_id);
create index if not exists idx_interactions_org       on interactions(organization_id, deal_id);
create index if not exists idx_tasks_org              on tasks(organization_id);
create index if not exists idx_tasks_org_assigned     on tasks(organization_id, assigned_to);
create index if not exists idx_tasks_org_deal         on tasks(organization_id, deal_id);
create index if not exists idx_ual_org                on user_activity_log(organization_id, user_id);
create index if not exists idx_us_org                 on user_sessions(organization_id, user_id);
create index if not exists idx_audit_org              on audit_log(organization_id);
create index if not exists idx_psh_org                on pipeline_stage_history(organization_id, deal_id);
create index if not exists idx_projects_org           on projects(organization_id);
create index if not exists idx_projects_org_status    on projects(organization_id, status);
create index if not exists idx_pd_org                 on project_deliverables(organization_id, project_id);
create index if not exists idx_pn_org                 on project_notes(organization_id, project_id);
create index if not exists idx_dai_org                on deal_ai_insights(organization_id, deal_id);
create index if not exists idx_notif_org              on notifications(organization_id, user_id, is_read);
create index if not exists idx_ar_org                 on automation_rules(organization_id);
create index if not exists idx_al_org                 on automation_logs(organization_id, rule_id);
create index if not exists idx_areas_org              on areas(organization_id);
create index if not exists idx_dm_org                 on direct_messages(organization_id);
create index if not exists idx_tm_org                 on team_messages(organization_id, deal_id);
create index if not exists idx_dmem_org               on deal_members(organization_id, deal_id);
create index if not exists idx_pmem_org               on project_members(organization_id, project_id);
create index if not exists idx_th_org                 on task_history(organization_id, task_id);
create index if not exists idx_wa_org                 on whatsapp_messages(organization_id, deal_id);

-- ────────────────────────────────────────────────────────────────
-- 6. FUNCIÓN HELPER — mismo patrón exacto que is_manager()/
--    current_user_role() ya existentes (security definer,
--    search_path fijo, stable: se evalúa una vez por query, no
--    fila por fila)
-- ────────────────────────────────────────────────────────────────

create or replace function current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from profiles where id = auth.uid()
$$;

create or replace function is_platform_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_owners where user_id = auth.uid())
$$;

grant execute on function current_org_id()   to authenticated;
grant execute on function is_platform_owner() to authenticated;

-- ⚠️ FIX CRÍTICO: can_see_deal() (ya existente, definida en
-- security_hardening.sql) solo verificaba rol/ownership, sin
-- verificar organización. is_manager() no distingue entre
-- organizaciones — un gerente de la Org A podía "ver" un deal de
-- la Org B si conocía su ID, porque can_see_deal() nunca comprobaba
-- a qué organización pertenece el deal. Se redefine agregando el
-- filtro de organización dentro de la función — así todas las
-- políticas que ya la usan (interactions, tasks, deal_ai_insights)
-- quedan corregidas de una sola vez, sin tocar cada política.
create or replace function can_see_deal(p_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from deals d
    where d.id = p_deal_id
      and d.organization_id = current_org_id()
      and (
        is_manager()
        or d.owner_id = auth.uid()
        or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid())
      )
  )
$$;

-- ────────────────────────────────────────────────────────────────
-- 7. TRIGGERS DE AUTO-RELLENO — para que ningún INSERT del código
--    (~211 call sites en src/) tenga que pasar organization_id a
--    mano. Dos familias: "raíz" (toma la org del usuario actual) y
--    "hija" (hereda la org de la fila padre — así siguen funcionando
--    los inserts vía service_role sin sesión de usuario, ej. el
--    webhook de WhatsApp entrante).
-- ────────────────────────────────────────────────────────────────

create or replace function set_org_from_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

create or replace function set_org_from_deal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then return new; end if;
  if new.deal_id is not null then
    select organization_id into new.organization_id from deals where id = new.deal_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

create or replace function set_org_from_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then return new; end if;
  if new.project_id is not null then
    select organization_id into new.organization_id from projects where id = new.project_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

create or replace function set_org_from_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then return new; end if;
  if new.task_id is not null then
    select organization_id into new.organization_id from tasks where id = new.task_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

create or replace function set_org_from_rule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then return new; end if;
  if new.rule_id is not null then
    select organization_id into new.organization_id from automation_rules where id = new.rule_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

create or replace function set_org_from_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null and new.user_id is not null then
    select organization_id into new.organization_id from profiles where id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace function set_org_for_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then return new; end if;
  if new.deal_id is not null then
    select organization_id into new.organization_id from deals where id = new.deal_id;
  elsif new.company_id is not null then
    select organization_id into new.organization_id from companies where id = new.company_id;
  end if;
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

-- Raíz: toma la org del usuario que inserta
drop trigger if exists trg_org_companies         on companies;
drop trigger if exists trg_org_contacts          on contacts;
drop trigger if exists trg_org_deals             on deals;
drop trigger if exists trg_org_automation_rules  on automation_rules;
drop trigger if exists trg_org_areas             on areas;
drop trigger if exists trg_org_direct_messages   on direct_messages;
drop trigger if exists trg_org_user_activity_log on user_activity_log;
drop trigger if exists trg_org_user_sessions     on user_sessions;
drop trigger if exists trg_org_audit_log         on audit_log;

create trigger trg_org_companies         before insert on companies         for each row execute function set_org_from_user();
create trigger trg_org_contacts          before insert on contacts          for each row execute function set_org_from_user();
create trigger trg_org_deals             before insert on deals             for each row execute function set_org_from_user();
create trigger trg_org_automation_rules  before insert on automation_rules  for each row execute function set_org_from_user();
create trigger trg_org_areas             before insert on areas             for each row execute function set_org_from_user();
create trigger trg_org_direct_messages   before insert on direct_messages   for each row execute function set_org_from_user();
create trigger trg_org_user_activity_log before insert on user_activity_log for each row execute function set_org_from_user();
create trigger trg_org_user_sessions     before insert on user_sessions     for each row execute function set_org_from_user();
create trigger trg_org_audit_log         before insert on audit_log         for each row execute function set_org_from_user();

-- Hija de un deal
drop trigger if exists trg_org_interactions          on interactions;
drop trigger if exists trg_org_tasks                 on tasks;
drop trigger if exists trg_org_pipeline_stage_history on pipeline_stage_history;
drop trigger if exists trg_org_deal_ai_insights       on deal_ai_insights;
drop trigger if exists trg_org_team_messages          on team_messages;
drop trigger if exists trg_org_deal_members           on deal_members;
drop trigger if exists trg_org_whatsapp_messages      on whatsapp_messages;

create trigger trg_org_interactions          before insert on interactions          for each row execute function set_org_from_deal();
create trigger trg_org_tasks                 before insert on tasks                 for each row execute function set_org_from_deal();
create trigger trg_org_pipeline_stage_history before insert on pipeline_stage_history for each row execute function set_org_from_deal();
create trigger trg_org_deal_ai_insights       before insert on deal_ai_insights       for each row execute function set_org_from_deal();
create trigger trg_org_team_messages          before insert on team_messages          for each row execute function set_org_from_deal();
create trigger trg_org_deal_members           before insert on deal_members           for each row execute function set_org_from_deal();
create trigger trg_org_whatsapp_messages      before insert on whatsapp_messages      for each row execute function set_org_from_deal();

-- Hija de un proyecto
drop trigger if exists trg_org_project_deliverables on project_deliverables;
drop trigger if exists trg_org_project_notes        on project_notes;
drop trigger if exists trg_org_project_members      on project_members;

create trigger trg_org_project_deliverables before insert on project_deliverables for each row execute function set_org_from_project();
create trigger trg_org_project_notes        before insert on project_notes        for each row execute function set_org_from_project();
create trigger trg_org_project_members      before insert on project_members      for each row execute function set_org_from_project();

-- Hija de una tarea / de una regla / de un destinatario
drop trigger if exists trg_org_task_history    on task_history;
drop trigger if exists trg_org_automation_logs on automation_logs;
drop trigger if exists trg_org_notifications   on notifications;

create trigger trg_org_task_history    before insert on task_history    for each row execute function set_org_from_task();
create trigger trg_org_automation_logs before insert on automation_logs for each row execute function set_org_from_rule();
create trigger trg_org_notifications   before insert on notifications   for each row execute function set_org_from_recipient();

-- Projects: caso especial (hereda de deal_id, si no de company_id, si no del usuario)
drop trigger if exists trg_org_projects on projects;
create trigger trg_org_projects before insert on projects for each row execute function set_org_for_project();

-- ────────────────────────────────────────────────────────────────
-- 8. POLÍTICAS RLS — se conserva toda la lógica de rol/ownership
--    ya existente, sumándole "AND organization_id = current_org_id()"
-- ────────────────────────────────────────────────────────────────

-- ---- organizations / platform_owners ----
drop policy if exists "organizations_select" on organizations;
create policy "organizations_select" on organizations
  for select using (is_platform_owner() or id = current_org_id());

drop policy if exists "platform_owners_select" on platform_owners;
create policy "platform_owners_select" on platform_owners
  for select using (is_platform_owner());

-- ---- profiles ----
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (auth.uid() is not null and organization_id = current_org_id());

drop policy if exists "profiles_update_self_norole" on profiles;
create policy "profiles_update_self_norole" on profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role::text = current_user_role()
    and is_active  = (select is_active from profiles where id = auth.uid())
    and organization_id = current_org_id()
  );

drop policy if exists "profiles_update_by_manager" on profiles;
create policy "profiles_update_by_manager" on profiles
  for update
  using (is_manager() and id <> auth.uid() and organization_id = current_org_id())
  with check (is_manager() and id <> auth.uid() and organization_id = current_org_id());

-- profiles_insert_self y service_role_select_profiles quedan igual
-- (alta inicial de perfil se hace siempre vía service_role, que
-- bypassa RLS y setea organization_id explícitamente en el código)

-- ---- companies ----
drop policy if exists "companies_select" on companies;
create policy "companies_select" on companies
  for select using (
    organization_id = current_org_id()
    and (
      is_manager()
      or exists (
        select 1 from deals d
        where d.company_id = companies.id
          and (d.owner_id = auth.uid()
               or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid()))
      )
    )
  );

drop policy if exists "companies_insert" on companies;
create policy "companies_insert" on companies
  for insert with check (auth.uid() is not null);

drop policy if exists "companies_update" on companies;
create policy "companies_update" on companies
  for update using (
    organization_id = current_org_id()
    and (is_manager() or exists (select 1 from deals d where d.company_id = companies.id and d.owner_id = auth.uid()))
  );

-- ---- contacts ----
drop policy if exists "contacts_select" on contacts;
create policy "contacts_select" on contacts
  for select using (
    organization_id = current_org_id()
    and (
      is_manager()
      or exists (
        select 1 from deals d
        where d.company_id = contacts.company_id
          and (d.owner_id = auth.uid()
               or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid()))
      )
    )
  );

drop policy if exists "contacts_insert" on contacts;
create policy "contacts_insert" on contacts
  for insert with check (auth.uid() is not null);

drop policy if exists "contacts_update" on contacts;
create policy "contacts_update" on contacts
  for update using (
    organization_id = current_org_id()
    and (is_manager() or exists (select 1 from deals d where d.company_id = contacts.company_id and d.owner_id = auth.uid()))
  );

-- ---- deals ----
drop policy if exists "deals_select" on deals;
create policy "deals_select" on deals
  for select using (
    organization_id = current_org_id()
    and (
      is_manager()
      or owner_id = auth.uid()
      or exists (select 1 from deal_members dm where dm.deal_id = deals.id and dm.user_id = auth.uid())
    )
  );

drop policy if exists "deals_insert" on deals;
create policy "deals_insert" on deals
  for insert with check (
    auth.uid() is not null
    and (owner_id = auth.uid() or is_manager())
  );

drop policy if exists "deals_update" on deals;
create policy "deals_update" on deals
  for update using (
    organization_id = current_org_id()
    and (
      is_manager()
      or owner_id = auth.uid()
      or exists (select 1 from deal_members dm where dm.deal_id = deals.id and dm.user_id = auth.uid())
    )
  );

drop policy if exists "deals_delete" on deals;
create policy "deals_delete" on deals
  for delete using (organization_id = current_org_id() and current_user_role() in ('super_admin','admin'));

-- ---- interactions ----
drop policy if exists "interactions_select" on interactions;
create policy "interactions_select" on interactions
  for select using (organization_id = current_org_id() and (deal_id is null or can_see_deal(deal_id)));

drop policy if exists "interactions_insert" on interactions;
create policy "interactions_insert" on interactions
  for insert with check (
    auth.uid() is not null
    and (deal_id is null or can_see_deal(deal_id))
    and organization_id = current_org_id()
  );

-- ---- tasks ----
drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks
  for select using (
    organization_id = current_org_id()
    and (
      is_manager()
      or assigned_to = auth.uid()
      or created_by  = auth.uid()
      or (deal_id is not null and can_see_deal(deal_id))
    )
  );

drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks
  for insert with check (
    auth.uid() is not null
    and (deal_id is null or can_see_deal(deal_id))
    and organization_id = current_org_id()
  );

drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks
  for update using (
    organization_id = current_org_id()
    and (is_manager() or assigned_to = auth.uid() or created_by = auth.uid())
  );

drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks
  for delete using (organization_id = current_org_id() and (is_manager() or created_by = auth.uid()));

-- ---- pipeline_stage_history ----
drop policy if exists "Authenticated users can view pipeline history" on pipeline_stage_history;
create policy "pipeline_stage_history_select" on pipeline_stage_history
  for select using (organization_id = current_org_id());

drop policy if exists "Authenticated users can insert pipeline history" on pipeline_stage_history;
create policy "pipeline_stage_history_insert" on pipeline_stage_history
  for insert with check (auth.uid() is not null and organization_id = current_org_id());

-- ---- user_activity_log / user_sessions / audit_log ----
drop policy if exists "Users can view own activity" on user_activity_log;
create policy "user_activity_log_select" on user_activity_log
  for select using (organization_id = current_org_id() and (auth.uid() = user_id or is_manager()));

drop policy if exists "System can insert activity" on user_activity_log;
create policy "user_activity_log_insert" on user_activity_log
  for insert with check (auth.uid() is not null);

drop policy if exists "Users can view own sessions" on user_sessions;
create policy "user_sessions_select" on user_sessions
  for select using (organization_id = current_org_id() and (auth.uid() = user_id or is_manager()));

drop policy if exists "Authenticated users can view audit log" on audit_log;
create policy "audit_log_select" on audit_log
  for select using (organization_id = current_org_id() and is_manager());

-- ---- projects / project_deliverables / project_notes ----
drop policy if exists "Authenticated users can manage projects" on projects;
create policy "projects_manage" on projects
  for all using (organization_id = current_org_id() and auth.uid() is not null)
  with check (organization_id = current_org_id() and auth.uid() is not null);

drop policy if exists "Authenticated users can manage deliverables" on project_deliverables;
create policy "project_deliverables_manage" on project_deliverables
  for all using (organization_id = current_org_id() and auth.uid() is not null)
  with check (organization_id = current_org_id() and auth.uid() is not null);

drop policy if exists "Authenticated users can manage project notes" on project_notes;
create policy "project_notes_manage" on project_notes
  for all using (organization_id = current_org_id() and auth.uid() is not null)
  with check (organization_id = current_org_id() and auth.uid() is not null);

-- ---- deal_ai_insights ----
drop policy if exists "deal_ai_insights_select" on deal_ai_insights;
create policy "deal_ai_insights_select" on deal_ai_insights
  for select using (organization_id = current_org_id() and can_see_deal(deal_id));

drop policy if exists "deal_ai_insights_insert" on deal_ai_insights;
create policy "deal_ai_insights_insert" on deal_ai_insights
  for insert with check (created_by = auth.uid() and can_see_deal(deal_id) and organization_id = current_org_id());

-- ---- notifications ----
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications
  for select using (organization_id = current_org_id() and auth.uid() = user_id);

drop policy if exists "notifications_insert_scoped" on notifications;
create policy "notifications_insert_scoped" on notifications
  for insert with check (
    (user_id = auth.uid() or is_manager())
    and organization_id = current_org_id()
  );

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update using (organization_id = current_org_id() and auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own" on notifications
  for delete using (organization_id = current_org_id() and auth.uid() = user_id);

-- ---- automation_rules / automation_logs ----
drop policy if exists "automation_rules_manage" on automation_rules;
create policy "automation_rules_manage" on automation_rules
  for all using (organization_id = current_org_id() and is_manager())
  with check (organization_id = current_org_id() and is_manager());

drop policy if exists "automation_rules_read_active" on automation_rules;
create policy "automation_rules_read_active" on automation_rules
  for select using (organization_id = current_org_id() and is_active = true);

drop policy if exists "automation_logs_manage" on automation_logs;
create policy "automation_logs_manage" on automation_logs
  for select using (organization_id = current_org_id() and is_manager());

drop policy if exists "automation_logs_insert" on automation_logs;
create policy "automation_logs_insert" on automation_logs
  for insert with check (auth.uid() is not null and organization_id = current_org_id());

-- ---- areas ----
drop policy if exists "areas_select" on areas;
create policy "areas_select" on areas
  for select to authenticated using (organization_id = current_org_id());

drop policy if exists "areas_manage" on areas;
create policy "areas_manage" on areas
  for all to authenticated
  using (organization_id = current_org_id() and is_manager())
  with check (organization_id = current_org_id() and is_manager());

-- Fix: "Ventas" debe poder repetirse entre organizaciones distintas
alter table areas drop constraint if exists areas_name_key;
alter table areas add constraint areas_org_name_unique unique (organization_id, name);

-- ---- direct_messages ----
drop policy if exists "dm_select_participants" on direct_messages;
create policy "dm_select_participants" on direct_messages
  for select to authenticated
  using (organization_id = current_org_id() and (auth.uid() = sender_id or auth.uid() = recipient_id));

drop policy if exists "dm_insert_sender" on direct_messages;
create policy "dm_insert_sender" on direct_messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (select 1 from profiles p where p.id = recipient_id and p.organization_id = current_org_id())
  );

drop policy if exists "dm_update_recipient" on direct_messages;
create policy "dm_update_recipient" on direct_messages
  for update to authenticated
  using (organization_id = current_org_id() and auth.uid() = recipient_id)
  with check (organization_id = current_org_id() and auth.uid() = recipient_id);

drop policy if exists "dm_delete_sender" on direct_messages;
create policy "dm_delete_sender" on direct_messages
  for delete to authenticated
  using (organization_id = current_org_id() and auth.uid() = sender_id);

-- ---- team_messages ----
-- OJO: hoy el select es "USING (true)" — literalmente global entre
-- TODAS las organizaciones. Es la fuga más grave detectada.
drop policy if exists "team_messages_select" on team_messages;
create policy "team_messages_select" on team_messages
  for select to authenticated using (organization_id = current_org_id());

drop policy if exists "team_messages_insert" on team_messages;
create policy "team_messages_insert" on team_messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and organization_id = current_org_id()
    and (deal_id is null or can_see_deal(deal_id))
  );

drop policy if exists "team_messages_delete" on team_messages;
create policy "team_messages_delete" on team_messages
  for delete to authenticated using (organization_id = current_org_id() and user_id = auth.uid());

-- ---- deal_members / project_members ----
drop policy if exists "deal_members_select" on deal_members;
create policy "deal_members_select" on deal_members
  for select using (organization_id = current_org_id() and (user_id = auth.uid() or added_by = auth.uid() or is_manager()));

drop policy if exists "deal_members_insert" on deal_members;
create policy "deal_members_insert" on deal_members
  for insert with check (
    is_manager()
    and organization_id = current_org_id()
    and exists (select 1 from deals d where d.id = deal_members.deal_id and d.organization_id = current_org_id())
  );

drop policy if exists "deal_members_delete" on deal_members;
create policy "deal_members_delete" on deal_members
  for delete using (organization_id = current_org_id() and is_manager());

drop policy if exists "project_members_select" on project_members;
create policy "project_members_select" on project_members
  for select using (organization_id = current_org_id() and (user_id = auth.uid() or added_by = auth.uid() or is_manager()));

drop policy if exists "project_members_insert" on project_members;
create policy "project_members_insert" on project_members
  for insert with check (
    is_manager()
    and organization_id = current_org_id()
    and exists (select 1 from projects pr where pr.id = project_members.project_id and pr.organization_id = current_org_id())
  );

drop policy if exists "project_members_delete" on project_members;
create policy "project_members_delete" on project_members
  for delete using (organization_id = current_org_id() and is_manager());

-- ---- task_history ----
-- OJO: hoy el select es "cualquier perfil activo" — global entre
-- organizaciones. Segunda fuga grave detectada.
drop policy if exists "task_history_select" on task_history;
create policy "task_history_select" on task_history
  for select using (organization_id = current_org_id());

drop policy if exists "task_history_insert" on task_history;
create policy "task_history_insert" on task_history
  for insert with check (changed_by = auth.uid() and organization_id = current_org_id());

-- ---- whatsapp_messages ----
drop policy if exists "whatsapp_messages_select" on whatsapp_messages;
create policy "whatsapp_messages_select" on whatsapp_messages
  for select using (
    organization_id = current_org_id()
    and exists (
      select 1 from deals d
      join profiles p on p.id = auth.uid()
      where d.id = whatsapp_messages.deal_id
        and (
          p.role in ('super_admin','admin','gerente')
          or d.owner_id = auth.uid()
          or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid())
        )
    )
  );

drop policy if exists "whatsapp_messages_insert" on whatsapp_messages;
create policy "whatsapp_messages_insert" on whatsapp_messages
  for insert with check (
    organization_id = current_org_id()
    and exists (
      select 1 from deals d
      join profiles p on p.id = auth.uid()
      where d.id = whatsapp_messages.deal_id
        and d.organization_id = current_org_id()
        and (
          p.role in ('super_admin','admin','gerente','comercial')
          or d.owner_id = auth.uid()
        )
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 9. STORAGE — bucket "propuestas" acotado por organización
--    La ruta del archivo debe empezar con el organization_id
--    (storage.objects no tiene fila relacional de la que heredar,
--    a diferencia de las tablas de arriba)
-- ────────────────────────────────────────────────────────────────

drop policy if exists "propuestas_auth_read" on storage.objects;
drop policy if exists "propuestas_auth_write" on storage.objects;
drop policy if exists "propuestas_auth_update" on storage.objects;

create policy "propuestas_org_read" on storage.objects
  for select using (
    bucket_id = 'propuestas'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "propuestas_org_write" on storage.objects
  for insert with check (
    bucket_id = 'propuestas'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "propuestas_org_update" on storage.objects
  for update using (
    bucket_id = 'propuestas'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = current_org_id()::text
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- FIN. Verificar después de ejecutar:
--   1. select id, name from organizations;  → debe verse la organización actual
--   2. select count(*) from deals where organization_id is null;  → debe ser 0
--   3. Iniciar sesión con el usuario actual y confirmar que el CRM
--      se ve exactamente igual que antes.
-- ════════════════════════════════════════════════════════════════
