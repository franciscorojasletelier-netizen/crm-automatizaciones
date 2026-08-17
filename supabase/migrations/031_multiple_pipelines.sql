-- ============================================================
--  FASE 8.4 — Múltiples pipelines por organización.
--
--  Hoy cada organización tiene UN solo embudo. Una empresa con más
--  de una línea de negocio (ej. "Proyectos nuevos" vs. "Renovación")
--  necesita embudos separados, con sus propias etapas.
--
--  DECISIÓN DE DISEÑO — por qué `key` sigue siendo único por
--  ORGANIZACIÓN y no por (organización, pipeline):
--  Casi toda la app resuelve una etapa con `stageByKey(stages, key)`
--  sin saber ni importarle a qué pipeline pertenece (dashboard,
--  reportes, tabla de leads, búsqueda global, historial). Si `key`
--  se pudiera repetir entre pipelines de la misma organización, TODO
--  ese código necesitaría volverse consciente del pipeline para no
--  confundir dos etapas con la misma clave. Manteniendo `key` único
--  por organización (cada pipeline nuevo simplemente no puede
--  reusar una clave ya tomada por otro), esos ~15 archivos siguen
--  funcionando sin tocarlos. Solo el kanban, la creación de leads y
--  el panel de plataforma — los únicos lugares donde "qué pipeline"
--  es una pregunta real — se vuelven conscientes de esto.
-- ============================================================

begin;

create table if not exists pipelines (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  name             text        not null,
  sort_order       integer     not null default 0,
  is_default       boolean     not null default false,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now()
);

-- Exactamente un pipeline por defecto activo por organización — mismo
-- patrón que ya existe para la etapa por defecto.
create unique index if not exists idx_pipeline_one_default
  on pipelines (organization_id) where is_default and is_active;

create index if not exists idx_pipelines_org on pipelines (organization_id, sort_order);

alter table pipelines enable row level security;

create policy "pipelines_select" on pipelines
  for select using (organization_id = current_org_id() or is_platform_owner());

create policy "pipelines_insert" on pipelines
  for insert with check (is_platform_owner());

create policy "pipelines_update" on pipelines
  for update using (is_platform_owner()) with check (is_platform_owner());

create policy "pipelines_delete" on pipelines
  for delete using (is_platform_owner());

grant select, insert, update, delete on pipelines to authenticated;
grant select, insert, update, delete on pipelines to service_role;

-- ────────────────────────────────────────────────────────────────
-- pipeline_stages y deals: agregar pipeline_id
-- ────────────────────────────────────────────────────────────────

alter table pipeline_stages add column if not exists pipeline_id uuid references pipelines(id);
alter table deals           add column if not exists pipeline_id uuid references pipelines(id);

-- Backfill: un pipeline "Pipeline principal" por organización existente,
-- con todas sus etapas y deals actuales asignados ahí. Cero cambio
-- visible para quien ya usa el CRM.
do $$
declare
  v_org uuid;
  v_pipeline_id uuid;
begin
  for v_org in select id from organizations loop
    insert into pipelines (organization_id, name, is_default, sort_order)
    values (v_org, 'Pipeline principal', true, 1)
    returning id into v_pipeline_id;

    update pipeline_stages set pipeline_id = v_pipeline_id
      where organization_id = v_org and pipeline_id is null;
    update deals set pipeline_id = v_pipeline_id
      where organization_id = v_org and pipeline_id is null;
  end loop;
end;
$$;

alter table pipeline_stages alter column pipeline_id set not null;
alter table deals           alter column pipeline_id set not null;

create index if not exists idx_stages_pipeline on pipeline_stages (pipeline_id, sort_order);
create index if not exists idx_deals_pipeline  on deals (pipeline_id);

-- El default/ganado ahora es POR PIPELINE, no por organización entera
-- (si no, activar el default de un pipeline nuevo desactivaría el del
-- pipeline existente).
drop index if exists idx_stage_one_default;
create unique index idx_stage_one_default
  on pipeline_stages (organization_id, pipeline_id) where is_default and is_active;

drop index if exists idx_stage_one_won;
create unique index idx_stage_one_won
  on pipeline_stages (organization_id, pipeline_id) where is_won and is_active;

-- ────────────────────────────────────────────────────────────────
-- Triggers/funciones que necesitan volverse conscientes del pipeline
-- ────────────────────────────────────────────────────────────────

-- Etapa por defecto al crear un deal: ahora primero resuelve el
-- pipeline (el del deal si vino explícito, si no el default de la
-- organización), y busca la etapa default DE ESE pipeline.
create or replace function set_default_stage_on_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if new.pipeline_id is null then
    select id into new.pipeline_id
      from pipelines where organization_id = new.organization_id and is_default and is_active
      limit 1;
    if new.pipeline_id is null then
      raise exception 'La organización % no tiene pipeline por defecto configurado', new.organization_id;
    end if;
  end if;

  if new.stage is not null then
    return new;
  end if;

  select key into v_stage
    from pipeline_stages
   where organization_id = new.organization_id
     and pipeline_id = new.pipeline_id
     and is_default and is_active
   limit 1;

  if v_stage is null then
    raise exception 'El pipeline % no tiene etapa por defecto configurada', new.pipeline_id;
  end if;

  new.stage := v_stage;
  return new;
end;
$$;

-- set_default_stage / set_won_stage: el UPDATE que "apaga" el default
-- anterior tiene que acotarse al MISMO pipeline de la etapa elegida,
-- no a toda la organización — si no, fijar el default en el pipeline
-- B apagaría el default del pipeline A.
create or replace function set_default_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  select pipeline_id into v_pipeline_id
    from pipeline_stages
   where id = p_stage_id and organization_id = p_org_id and is_active;

  if v_pipeline_id is null then
    raise exception 'La etapa no existe, no está activa, o no pertenece a esta organización';
  end if;

  update pipeline_stages
     set is_default = (id = p_stage_id)
   where organization_id = p_org_id and pipeline_id = v_pipeline_id;
end;
$$;

create or replace function set_won_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  select pipeline_id into v_pipeline_id
    from pipeline_stages
   where id = p_stage_id and organization_id = p_org_id
     and is_active and is_terminal and not is_lost;

  if v_pipeline_id is null then
    raise exception 'La etapa de ganado debe existir, estar activa, ser terminal y no estar marcada como perdida';
  end if;

  update pipeline_stages
     set is_won = (id = p_stage_id)
   where organization_id = p_org_id and pipeline_id = v_pipeline_id;
end;
$$;

-- Crear un pipeline nuevo con una primera etapa default mínima —
-- sin esto, un pipeline recién creado viola set_default_stage_on_deal
-- apenas alguien intente crear un deal ahí.
create or replace function create_pipeline(p_org_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
  v_next_order integer;
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para crear pipelines';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_order from pipelines where organization_id = p_org_id;

  insert into pipelines (organization_id, name, sort_order, is_default)
  values (p_org_id, p_name, v_next_order, false)
  returning id into v_pipeline_id;

  insert into pipeline_stages (
    organization_id, pipeline_id, key, label, color, sort_order,
    is_terminal, is_won, is_lost, is_default, in_funnel, default_probability
  ) values
    (p_org_id, v_pipeline_id, p_name || '_nuevo_' || substr(v_pipeline_id::text, 1, 8), 'Nuevo', 'blue', 1, false, false, false, true, true, 10),
    (p_org_id, v_pipeline_id, p_name || '_ganado_' || substr(v_pipeline_id::text, 1, 8), 'Ganado ✓', 'green', 2, true, true, false, false, false, 100);

  return v_pipeline_id;
end;
$$;

grant execute on function create_pipeline(uuid, text) to authenticated;

commit;
