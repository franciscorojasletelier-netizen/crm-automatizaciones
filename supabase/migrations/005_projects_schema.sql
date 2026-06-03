-- Fix tabla projects con fases correctas y entregables

create type project_phase as enum (
  'discovery',
  'diseno',
  'desarrollo',
  'pruebas',
  'entrega',
  'soporte'
);

create type project_status as enum (
  'activo',
  'pausado',
  'entregado',
  'cancelado'
);

-- Recrear tabla projects con tipos correctos
drop table if exists projects cascade;

create table projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  company_id uuid references companies(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  proposal_id uuid,
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  phase project_phase not null default 'discovery',
  status project_status not null default 'activo',
  budget numeric(12,2),
  estimated_hours integer,
  actual_hours integer default 0,
  customer_satisfaction_score integer check (customer_satisfaction_score between 1 and 5),
  notes text,
  start_date date,
  due_date date,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_deliverables (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  description text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  due_date date,
  created_at timestamptz not null default now()
);

create table project_notes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  content text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

-- Trigger updated_at
create trigger trg_projects_updated before update on projects
  for each row execute function update_updated_at();

-- Índices
create index idx_projects_company on projects(company_id);
create index idx_projects_deal on projects(deal_id);
create index idx_projects_status on projects(status);
create index idx_deliverables_project on project_deliverables(project_id);

-- RLS
alter table projects enable row level security;
alter table project_deliverables enable row level security;
alter table project_notes enable row level security;

create policy "Authenticated users can manage projects"
  on projects for all using (auth.uid() is not null);

create policy "Authenticated users can manage deliverables"
  on project_deliverables for all using (auth.uid() is not null);

create policy "Authenticated users can manage project notes"
  on project_notes for all using (auth.uid() is not null);

-- Grants
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on project_deliverables to authenticated;
grant select, insert, update, delete on project_notes to authenticated;
