-- ============================================================
--  FASE 1 — Fundación: CRM configurable por organización
--
--  Convierte el comportamiento del CRM (embudo, campos, módulos)
--  de código hardcodeado a datos por organización.
--
--  REGLA DE ESTA MIGRACIÓN: no debe cambiar NADA visible. Las
--  claves de etapa se conservan idénticas, así que el frontend
--  hardcodeado sigue funcionando igual hasta la Fase 2.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────────
-- 1. PIPELINE_STAGES — el embudo de cada organización
--
--    `color` guarda un TOKEN de paleta fija, no una clase de
--    Tailwind. Tailwind purga en build: `bg-${color}-500` armado
--    desde la base no genera CSS. src/lib/stages.ts mapea
--    token → clases. Paleta válida:
--    blue, yellow, purple, indigo, cyan, orange, pink, green,
--    red, gray, slate, emerald, amber, teal, rose
-- ────────────────────────────────────────────────────────────────

create table if not exists pipeline_stages (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,

  -- key: identificador técnico, INMUTABLE (ver trigger más abajo).
  -- label: texto visible, editable libremente.
  key                 text not null,
  label               text not null,
  color               text not null default 'slate',
  sort_order          integer not null default 0,

  -- Banderas semánticas: reemplazan a los arrays hardcodeados del frontend.
  is_terminal         boolean not null default false,  -- bandeja de cierre, no columna del kanban
  is_won              boolean not null default false,  -- deriva deals.status = 'won'
  is_lost             boolean not null default false,  -- deriva deals.status = 'lost'
  is_default          boolean not null default false,  -- etapa inicial de un deal nuevo
  in_funnel           boolean not null default false,  -- aparece en el gráfico de embudo
  requires_reason     boolean not null default false,  -- pide motivo al entrar
  requires_attachment boolean not null default false,  -- exige AL MENOS UN adjunto (no dice de qué tipo)
  creates_project     boolean not null default false,  -- crea un proyecto automáticamente
  default_probability integer not null default 0 check (default_probability between 0 and 100),

  -- Textos del modal de confirmación (solo si requires_reason).
  -- reasons: array de strings, ej. '["Precio muy alto","Otro"]'
  reasons             jsonb not null default '[]',
  modal_title         text,
  modal_subtitle      text,
  confirm_label       text,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),

  unique (organization_id, key),

  -- ganado y perdido son mutuamente excluyentes
  constraint stage_won_xor_lost check (not (is_won and is_lost)),
  -- ganado y perdido son siempre terminales
  constraint stage_closed_is_terminal check (not (is_won or is_lost) or is_terminal)
);

-- Exactamente una etapa por defecto activa por organización.
create unique index if not exists idx_stage_one_default
  on pipeline_stages (organization_id) where is_default and is_active;

-- Exactamente una etapa de "ganado" activa por organización.
-- (is_lost SÍ admite varias: hoy cerrado_perdido y no_calificado
--  producen ambas status='lost', y son distinciones que el negocio usa.)
create unique index if not exists idx_stage_one_won
  on pipeline_stages (organization_id) where is_won and is_active;

create index if not exists idx_stages_org_order
  on pipeline_stages (organization_id, sort_order);

-- ────────────────────────────────────────────────────────────────
-- 2. FIELD_DEFINITIONS — campos propios de cada organización
--
--    CONTRATO DE `options`:
--      select / multiselect → [{"value":"casa","label":"Casa"}]
--      cualquier otro tipo  → []
--    `value` es el identificador estable que se guarda en
--    custom_fields; `label` es solo presentación. Misma separación
--    que key/label en las etapas, por la misma razón: renombrar la
--    etiqueta no debe reescribir los datos ya guardados.
-- ────────────────────────────────────────────────────────────────

create table if not exists field_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  entity          text not null check (entity in ('deal','company','contact')),
  key             text not null,
  label           text not null,
  field_type      text not null check (field_type in
                    ('text','textarea','number','currency','date','select','multiselect','boolean')),
  options         jsonb not null default '[]',

  placeholder     text,
  help_text       text,
  is_required     boolean not null default false,

  -- Reservados: todavía no se consumen. Quedan definidos para que
  -- la búsqueda global y los filtros de la tabla de leads puedan
  -- usarlos más adelante sin otra migración.
  is_searchable   boolean not null default false,
  is_filterable   boolean not null default false,

  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),

  unique (organization_id, entity, key)
);

create index if not exists idx_fielddefs_org_entity
  on field_definitions (organization_id, entity, sort_order);

-- ────────────────────────────────────────────────────────────────
-- 3. ORGANIZATION_MODULES — qué secciones tiene contratadas cada cliente
--
--    Se eligió tabla en vez de un text[] en organizations porque el
--    paso siguiente del producto es licenciamiento (planes, límites,
--    vencimientos) y agregarlo después obligaría a migrar datos.
--    En esta fase SOLO se lee `enabled`; config y expires_at quedan
--    reservados y sin lógica asociada.
--
--    Lectura FAIL-OPEN: la ausencia de fila significa habilitado.
--    Así, agregar una sección nueva al CRM no la deja invisible para
--    todas las organizaciones existentes hasta sembrarla a mano.
--    (Cuando exista licenciamiento real, esto pasa a fail-closed.)
-- ────────────────────────────────────────────────────────────────

create table if not exists organization_modules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key      text not null,
  enabled         boolean not null default true,
  config          jsonb not null default '{}',
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),

  unique (organization_id, module_key)
);

create index if not exists idx_orgmodules_org
  on organization_modules (organization_id);

-- ────────────────────────────────────────────────────────────────
-- 4. CUSTOM_FIELDS — valores de los campos personalizados
-- ────────────────────────────────────────────────────────────────

alter table deals     add column if not exists custom_fields jsonb not null default '{}';
alter table companies add column if not exists custom_fields jsonb not null default '{}';
alter table contacts  add column if not exists custom_fields jsonb not null default '{}';

-- ────────────────────────────────────────────────────────────────
-- 5. RLS + GRANTS
--
--    ⚠️ Patrón que ya falló tres veces en este proyecto:
--    política RLS sin GRANT = 0 filas, sin ningún error visible.
--    Van siempre juntos.
--
--    Lectura: cualquier usuario de la organización (necesita ver su
--             propio embudo para usar el CRM).
--    Escritura: solo platform_owners — el cliente NO configura.
-- ────────────────────────────────────────────────────────────────

alter table pipeline_stages      enable row level security;
alter table field_definitions    enable row level security;
alter table organization_modules enable row level security;

-- pipeline_stages
drop policy if exists "pipeline_stages_select" on pipeline_stages;
create policy "pipeline_stages_select" on pipeline_stages
  for select using (organization_id = current_org_id() or is_platform_owner());

drop policy if exists "pipeline_stages_insert" on pipeline_stages;
create policy "pipeline_stages_insert" on pipeline_stages
  for insert with check (is_platform_owner());

drop policy if exists "pipeline_stages_update" on pipeline_stages;
create policy "pipeline_stages_update" on pipeline_stages
  for update using (is_platform_owner()) with check (is_platform_owner());

drop policy if exists "pipeline_stages_delete" on pipeline_stages;
create policy "pipeline_stages_delete" on pipeline_stages
  for delete using (is_platform_owner());

-- field_definitions
drop policy if exists "field_definitions_select" on field_definitions;
create policy "field_definitions_select" on field_definitions
  for select using (organization_id = current_org_id() or is_platform_owner());

drop policy if exists "field_definitions_insert" on field_definitions;
create policy "field_definitions_insert" on field_definitions
  for insert with check (is_platform_owner());

drop policy if exists "field_definitions_update" on field_definitions;
create policy "field_definitions_update" on field_definitions
  for update using (is_platform_owner()) with check (is_platform_owner());

drop policy if exists "field_definitions_delete" on field_definitions;
create policy "field_definitions_delete" on field_definitions
  for delete using (is_platform_owner());

-- organization_modules
drop policy if exists "organization_modules_select" on organization_modules;
create policy "organization_modules_select" on organization_modules
  for select using (organization_id = current_org_id() or is_platform_owner());

drop policy if exists "organization_modules_insert" on organization_modules;
create policy "organization_modules_insert" on organization_modules
  for insert with check (is_platform_owner());

drop policy if exists "organization_modules_update" on organization_modules;
create policy "organization_modules_update" on organization_modules
  for update using (is_platform_owner()) with check (is_platform_owner());

drop policy if exists "organization_modules_delete" on organization_modules;
create policy "organization_modules_delete" on organization_modules
  for delete using (is_platform_owner());

-- GRANTs (sin esto, las políticas de arriba devuelven 0 filas)
grant select, insert, update, delete on pipeline_stages      to authenticated;
grant select, insert, update, delete on field_definitions    to authenticated;
grant select, insert, update, delete on organization_modules to authenticated;

grant select, insert, update, delete on pipeline_stages      to service_role;
grant select, insert, update, delete on field_definitions    to service_role;
grant select, insert, update, delete on organization_modules to service_role;

-- ────────────────────────────────────────────────────────────────
-- 6. SIEMBRA — embudo y módulos por defecto
--
--    Reproduce EXACTAMENTE el comportamiento hardcodeado de hoy.
--    Cualquier diferencia acá sería un cambio visible, y esta fase
--    no debe cambiar nada.
-- ────────────────────────────────────────────────────────────────

create or replace function seed_default_stages(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pipeline_stages (
    organization_id, key, label, color, sort_order,
    is_terminal, is_won, is_lost, is_default, in_funnel,
    requires_reason, requires_attachment, creates_project,
    default_probability, reasons, modal_title, modal_subtitle, confirm_label
  ) values
    (p_org_id, 'nuevo_lead', 'Nuevo Lead', 'blue', 1,
     false, false, false, true, true, false, false, false, 10, '[]', null, null, null),

    (p_org_id, 'contactado', 'Contactado', 'yellow', 2,
     false, false, false, false, true, false, false, false, 20, '[]', null, null, null),

    (p_org_id, 'calificado', 'Calificado', 'purple', 3,
     false, false, false, false, true, false, false, false, 30, '[]', null, null, null),

    (p_org_id, 'reunion_agendada', 'Reunión Agendada', 'indigo', 4,
     false, false, false, false, true, false, false, false, 40, '[]', null, null, null),

    -- reunion_realizada NO está en el embudo del gráfico hoy
    -- (dashboard/page.tsx:198 y reportes/page.tsx:136 la omiten).
    (p_org_id, 'reunion_realizada', 'Reunión Realizada', 'cyan', 5,
     false, false, false, false, false, false, false, false, 50, '[]', null, null, null),

    (p_org_id, 'propuesta_enviada', 'Propuesta Enviada', 'orange', 6,
     false, false, false, false, true, false, true, false, 60, '[]', null, null, null),

    (p_org_id, 'negociacion', 'Negociación', 'pink', 7,
     false, false, false, false, true, false, false, false, 80, '[]', null, null, null),

    (p_org_id, 'cerrado_ganado', 'Ganado ✓', 'green', 8,
     true, true, false, false, false, false, false, true, 100, '[]', null, null, null),

    -- Las listas de razones son la UNIÓN de las dos que existían:
    -- kanban-board.tsx y deal-stage-selector.tsx tenían listas distintas
    -- para la misma etapa (el selector incluía "Negociación demasiado
    -- prolongada" y "Fuera del área geográfica", el kanban no). Al unificar
    -- se conservan todas para no perder ninguna opción en ninguna pantalla.
    (p_org_id, 'cerrado_perdido', 'Perdido', 'red', 9,
     true, false, true, false, false, true, false, false, 0,
     '["Precio muy alto","Eligió a la competencia","Sin presupuesto disponible","Sin urgencia o prioridad","Contacto no es el decisor","Proyecto cancelado por cliente","Negociación demasiado prolongada","Propuesta no convenció","Otro"]',
     '¿Por qué se perdió este deal?',
     'Esta información ayuda al gerente a mejorar la estrategia comercial.',
     'Confirmar pérdida'),

    (p_org_id, 'no_calificado', 'No Calificado', 'gray', 10,
     true, false, true, false, false, true, false, false, 0,
     '["No tiene presupuesto","No es el mercado objetivo","Ya tiene una solución similar","Empresa demasiado pequeña","Fuera del área geográfica","Sin autoridad de compra","Sector no compatible","Otro"]',
     '¿Por qué no está calificado?',
     'Explica al gerente por qué este lead no cumple los criterios.',
     'Marcar como no calificado'),

    -- frio es terminal (va a la bandeja de cierre) pero NO es is_lost:
    -- hoy kanban-board.tsx:55 lo excluye de CLOSED_STAGES, así que el
    -- deal queda con status='open'. Y default_probability=10 replica el
    -- fallback `?? 10` de reportes/page.tsx:118 — un deal frío sigue
    -- contando en el forecast igual que hoy. Ambas cosas son fidelidad
    -- deliberada al comportamiento actual, no criterio de negocio:
    -- se cambian desde el panel, no tocando código.
    (p_org_id, 'frio', 'Frío ❄️', 'slate', 11,
     true, false, false, false, false, true, false, false, 10,
     '["Cliente pidió pausar","Esperando decisión interna del cliente","Presupuesto bloqueado temporalmente","Reorganización en la empresa del cliente","Sin respuesta por más de 30 días","Otro"]',
     '¿Por qué se congela este deal?',
     'Indica al gerente la razón y si vale la pena retomarlo en el futuro.',
     'Congelar deal')
  on conflict (organization_id, key) do nothing;
end;
$$;

create or replace function seed_default_modules(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into organization_modules (organization_id, module_key, enabled)
  select p_org_id, m, true
    from unnest(array[
      'dashboard','pipeline','leads','empresas','tareas','proyectos',
      'calendario','organigrama','notificaciones','reportes',
      'automatizaciones','actividad','usuarios','configuracion'
    ]) as m
  on conflict (organization_id, module_key) do nothing;
end;
$$;

grant execute on function seed_default_stages(uuid)  to service_role;
grant execute on function seed_default_modules(uuid) to service_role;

-- Sembrar TODAS las organizaciones que ya existen.
do $$
declare
  v_org uuid;
begin
  for v_org in select id from organizations loop
    perform seed_default_stages(v_org);
    perform seed_default_modules(v_org);
  end loop;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 7. ENUM → TEXT + FK COMPUESTA
--
--    La FK compuesta hace estructuralmente imposible que un deal
--    apunte a una etapa de otra organización. Además de garantizar
--    integridad del embudo, cierra la deuda de "integridad
--    referencial cruzada entre organizaciones" que quedó documentada
--    en la migración multi-tenant.
--
--    pipeline_stage_history va a text SIN FK: es historial, tiene
--    que sobrevivir a que una etapa se desactive.
-- ────────────────────────────────────────────────────────────────

alter table deals alter column stage drop default;
alter table deals alter column stage type text using stage::text;

alter table pipeline_stage_history alter column from_stage type text using from_stage::text;
alter table pipeline_stage_history alter column to_stage   type text using to_stage::text;

-- El tipo enum queda sin uso. Se elimina para que nadie lo reintroduzca
-- por error; si algo todavía lo referenciara, esto falla y revierte
-- toda la migración, que es exactamente lo que queremos saber ahora.
drop type if exists deal_stage;

alter table deals drop constraint if exists deals_stage_fk;
alter table deals add constraint deals_stage_fk
  foreign key (organization_id, stage)
  references pipeline_stages (organization_id, key);

-- ────────────────────────────────────────────────────────────────
-- 8. TRIGGERS DE INTEGRIDAD
-- ────────────────────────────────────────────────────────────────

-- 8a. Etapa por defecto al crear un deal.
--     Permite que los 5 lugares que hoy hardcodean 'nuevo_lead'
--     simplemente omitan el campo. Los webhooks no necesitan saber
--     nada del embudo del cliente.
create or replace function set_default_stage_on_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if new.stage is not null then
    return new;
  end if;

  select key into v_stage
    from pipeline_stages
   where organization_id = new.organization_id
     and is_default and is_active
   limit 1;

  if v_stage is null then
    raise exception 'La organización % no tiene etapa por defecto configurada', new.organization_id;
  end if;

  new.stage := v_stage;
  return new;
end;
$$;

-- Corre DESPUÉS de trg_org_deals (que rellena organization_id):
-- los triggers BEFORE del mismo evento se ejecutan por orden
-- alfabético de nombre, y 'trg_stage_default' > 'trg_org_deals'.
drop trigger if exists trg_stage_default on deals;
create trigger trg_stage_default
  before insert on deals
  for each row execute function set_default_stage_on_deal();

-- 8b. `key` es inmutable, y no se puede desactivar la etapa por
--     defecto ni la de ganado sin designar reemplazo primero.
create or replace function guard_pipeline_stage_update()
returns trigger
language plpgsql
as $$
begin
  if new.key is distinct from old.key then
    raise exception 'La clave de una etapa no se puede cambiar (% → %). Es un identificador técnico: editá el label.', old.key, new.key;
  end if;

  if old.is_active and not new.is_active then
    if old.is_default then
      raise exception 'No se puede desactivar la etapa por defecto. Designá otra como default primero.';
    end if;
    if old.is_won then
      raise exception 'No se puede desactivar la etapa de ganado. Designá otra como ganado primero.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_stage_update on pipeline_stages;
create trigger trg_guard_stage_update
  before update on pipeline_stages
  for each row execute function guard_pipeline_stage_update();

-- 8c. No borrar etapas con historial.
--     La FK desde deals ya bloquea (RESTRICT) las que tienen deals
--     asignados; esto cubre el historial, que no tiene FK a propósito.
create or replace function guard_pipeline_stage_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from pipeline_stage_history h
     join deals d on d.id = h.deal_id
    where d.organization_id = old.organization_id
      and (h.from_stage = old.key or h.to_stage = old.key)
  ) then
    raise exception 'La etapa "%" tiene historial y no se puede eliminar. Desactivala con is_active = false.', old.key;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_stage_delete on pipeline_stages;
create trigger trg_guard_stage_delete
  before delete on pipeline_stages
  for each row execute function guard_pipeline_stage_delete();

-- ────────────────────────────────────────────────────────────────
-- 9. CAMBIAR LA ETAPA DEFAULT / DE GANADO
--
--    (Corregido en 016_fix_stage_default_swap.sql — ver ese archivo
--    para la explicación completa de por qué la versión de acá con
--    un solo UPDATE podía violar el índice único a mitad de camino.)
--    El panel usa estas funciones; nunca escribe is_default/is_won
--    directo.
-- ────────────────────────────────────────────────────────────────

create or replace function set_default_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  if not exists (
    select 1 from pipeline_stages
     where id = p_stage_id and organization_id = p_org_id and is_active
  ) then
    raise exception 'La etapa no existe, no está activa, o no pertenece a esta organización';
  end if;

  update pipeline_stages
     set is_default = (id = p_stage_id)
   where organization_id = p_org_id;
end;
$$;

create or replace function set_won_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  if not exists (
    select 1 from pipeline_stages
     where id = p_stage_id and organization_id = p_org_id
       and is_active and is_terminal and not is_lost
  ) then
    raise exception 'La etapa de ganado debe existir, estar activa, ser terminal y no estar marcada como perdida';
  end if;

  update pipeline_stages
     set is_won = (id = p_stage_id)
   where organization_id = p_org_id;
end;
$$;

grant execute on function set_default_stage(uuid, uuid) to authenticated;
grant execute on function set_won_stage(uuid, uuid)     to authenticated;

commit;
