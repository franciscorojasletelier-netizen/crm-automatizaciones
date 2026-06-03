-- ============================================================
-- CRM Automatizaciones — Schema inicial MVP
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- ROLES Y USUARIOS
-- ============================================================

create type user_role as enum ('admin', 'comercial', 'operaciones', 'finanzas');

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  workspace_id uuid,
  full_name text not null,
  email text not null,
  role user_role not null default 'comercial',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EMPRESAS Y CONTACTOS
-- ============================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  name text not null,
  industry text,
  website text,
  country text,
  employee_count integer,
  is_existing_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  company_id uuid references companies(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  job_title text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PIPELINE COMERCIAL
-- ============================================================

create type deal_stage as enum (
  'nuevo_lead',
  'contactado',
  'calificado',
  'reunion_agendada',
  'reunion_realizada',
  'propuesta_enviada',
  'negociacion',
  'cerrado_ganado',
  'cerrado_perdido',
  'no_calificado',
  'frio'
);

create type deal_type as enum ('new_business', 'upsell', 'renewal');
create type deal_status as enum ('open', 'won', 'lost');

create table deals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  company_id uuid references companies(id) on delete set null,
  primary_contact_id uuid references contacts(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  deal_type deal_type not null default 'new_business',
  source text,
  stage deal_stage not null default 'nuevo_lead',
  score integer not null default 0,
  estimated_value numeric(12,2),
  probability integer default 0 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  product_line text,
  competitors text,
  status deal_status not null default 'open',
  lost_reason text,
  calification_reason text,
  extension_reason text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contacted_at timestamptz
);

create table pipeline_stage_history (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid references deals(id) on delete cascade not null,
  from_stage deal_stage,
  to_stage deal_stage not null,
  changed_by uuid references profiles(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

-- ============================================================
-- INTERACCIONES Y TAREAS
-- ============================================================

create type interaction_type as enum ('email', 'call', 'meeting', 'note');
create type interaction_direction as enum ('inbound', 'outbound');

create table interactions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  deal_id uuid references deals(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  type interaction_type not null,
  direction interaction_direction,
  content text,
  cost numeric(10,2),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  deal_id uuid references deals(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  due_date timestamptz,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SUPERVISIÓN DE EMPLEADOS
-- ============================================================

create table user_activity_log (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  user_id uuid references profiles(id) on delete cascade not null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table user_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  user_id uuid references profiles(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip_address text,
  device_info text
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  sensitive_data_accessed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_deals_owner on deals(owner_id);
create index idx_deals_stage on deals(stage);
create index idx_deals_status on deals(status);
create index idx_deals_company on deals(company_id);
create index idx_interactions_deal on interactions(deal_id);
create index idx_tasks_deal on tasks(deal_id);
create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_due on tasks(due_date) where is_completed = false;
create index idx_pipeline_history_deal on pipeline_stage_history(deal_id);
create index idx_activity_log_user on user_activity_log(user_id);
create index idx_activity_log_created on user_activity_log(created_at);

-- ============================================================
-- FUNCIONES DE ACTUALIZACIÓN AUTOMÁTICA
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated before update on companies
  for each row execute function update_updated_at();

create trigger trg_contacts_updated before update on contacts
  for each row execute function update_updated_at();

create trigger trg_deals_updated before update on deals
  for each row execute function update_updated_at();

create trigger trg_tasks_updated before update on tasks
  for each row execute function update_updated_at();

create trigger trg_profiles_updated before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- FUNCIÓN: registrar historial de etapas automáticamente
-- ============================================================

create or replace function log_deal_stage_change()
returns trigger as $$
begin
  if old.stage is distinct from new.stage then
    insert into pipeline_stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, new.owner_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_deal_stage_history after update on deals
  for each row execute function log_deal_stage_change();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table pipeline_stage_history enable row level security;
alter table interactions enable row level security;
alter table tasks enable row level security;
alter table user_activity_log enable row level security;
alter table user_sessions enable row level security;
alter table audit_log enable row level security;

-- Políticas base: el usuario autenticado ve sus propios datos
-- Admin ve todo (se refinará con roles en fase 2)

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Authenticated users can view companies"
  on companies for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert companies"
  on companies for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update companies"
  on companies for update using (auth.role() = 'authenticated');

create policy "Authenticated users can view contacts"
  on contacts for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert contacts"
  on contacts for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update contacts"
  on contacts for update using (auth.role() = 'authenticated');

create policy "Authenticated users can view deals"
  on deals for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert deals"
  on deals for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update deals"
  on deals for update using (auth.role() = 'authenticated');

create policy "Authenticated users can view interactions"
  on interactions for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert interactions"
  on interactions for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can view tasks"
  on tasks for select using (auth.role() = 'authenticated');

create policy "Authenticated users can manage tasks"
  on tasks for all using (auth.role() = 'authenticated');

create policy "Authenticated users can view pipeline history"
  on pipeline_stage_history for select using (auth.role() = 'authenticated');

create policy "Users can view own activity"
  on user_activity_log for select using (auth.uid() = user_id);

create policy "System can insert activity"
  on user_activity_log for insert with check (auth.role() = 'authenticated');

create policy "Users can view own sessions"
  on user_sessions for select using (auth.uid() = user_id);

create policy "Authenticated users can view audit log"
  on audit_log for select using (auth.role() = 'authenticated');
