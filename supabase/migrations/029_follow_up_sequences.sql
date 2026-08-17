-- ============================================================
--  FASE 8.1 — Secuencias de follow-up automatizadas.
--
--  Las automatizaciones existentes (automation_rules) disparan UNA
--  acción por evento (cambio de etapa, ganado, perdido, días sin
--  actividad). Esto agrega pasos ENCADENADOS con espera entre cada
--  uno — ej. "si el lead no avanza, mandar WhatsApp a las 48h, y si
--  sigue sin respuesta, crear tarea para el vendedor a los 5 días".
--
--  Tres tablas:
--  - automation_sequences: la secuencia en sí (nombre, disparador).
--  - automation_sequence_steps: los pasos ordenados con su demora.
--  - automation_sequence_enrollments: el progreso de CADA deal
--    dentro de una secuencia — sin esto no hay forma de saber en
--    qué paso va cada deal ni cuándo le toca el siguiente.
-- ============================================================

begin;

create table if not exists automation_sequences (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  name             text        not null,
  description      text,
  -- Mismo vocabulario que automation_rules.trigger_type, acotado a los
  -- disparadores que tiene sentido "empezar a esperar" — no days_inactive,
  -- que ya es en sí un disparador de espera.
  trigger_type     text        not null check (trigger_type in ('stage_change', 'deal_created')),
  trigger_config   jsonb       not null default '{}',
  is_active        boolean     not null default true,
  created_by       uuid        references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists automation_sequence_steps (
  id               uuid        primary key default gen_random_uuid(),
  sequence_id      uuid        not null references automation_sequences(id) on delete cascade,
  step_order       integer     not null,
  -- Horas desde que se completó el paso anterior (o desde el enrollment,
  -- para el primer paso). No desde un timestamp fijo — así una secuencia
  -- sirve para cualquier deal que entre, sin importar cuándo.
  delay_hours      integer     not null default 24,
  action_type      text        not null check (action_type in ('send_whatsapp_template', 'create_task', 'notify_owner', 'notify_team')),
  action_config    jsonb       not null default '{}',
  created_at       timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create table if not exists automation_sequence_enrollments (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  sequence_id      uuid        not null references automation_sequences(id) on delete cascade,
  deal_id          uuid        not null references deals(id) on delete cascade,
  -- La etapa del deal AL MOMENTO de inscribirse — si cambia, la secuencia
  -- se detiene (dejó de tener sentido seguir insistiendo).
  enrolled_stage   text        not null,
  current_step     integer     not null default 0, -- 0 = todavía no ejecutó ningún paso
  status           text        not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stopped_reason   text,
  next_run_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (sequence_id, deal_id) -- un deal no se inscribe dos veces a la misma secuencia
);

create index if not exists idx_sequences_org               on automation_sequences(organization_id);
create index if not exists idx_sequence_steps_sequence      on automation_sequence_steps(sequence_id, step_order);
create index if not exists idx_sequence_enrollments_pending on automation_sequence_enrollments(status, next_run_at) where status = 'active';
create index if not exists idx_sequence_enrollments_deal    on automation_sequence_enrollments(deal_id);

alter table automation_sequences enable row level security;
alter table automation_sequence_steps enable row level security;
alter table automation_sequence_enrollments enable row level security;

-- Mismo patrón que automation_rules: cualquiera de la org puede ver las
-- secuencias activas (para entender qué automatización está corriendo
-- sobre "su" deal), solo un manager las crea/edita.
create or replace function set_org_automation_sequences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    if new.organization_id is null then new.organization_id := current_org_id(); end if;
    return new;
  end if;
  new.organization_id := current_org_id();
  return new;
end;
$$;

drop trigger if exists trg_org_automation_sequences on automation_sequences;
create trigger trg_org_automation_sequences before insert on automation_sequences
  for each row execute function set_org_automation_sequences();

create policy "automation_sequences_select" on automation_sequences
  for select using (organization_id = current_org_id() and is_active = true);

create policy "automation_sequences_manage" on automation_sequences
  for all using (organization_id = current_org_id() and is_manager())
  with check (organization_id = current_org_id() and is_manager());

-- Los pasos heredan el aislamiento de su secuencia (no tienen
-- organization_id propio, se resuelve por join).
create policy "automation_sequence_steps_select" on automation_sequence_steps
  for select using (exists (
    select 1 from automation_sequences s
    where s.id = automation_sequence_steps.sequence_id and s.organization_id = current_org_id()
  ));

create policy "automation_sequence_steps_manage" on automation_sequence_steps
  for all using (exists (
    select 1 from automation_sequences s
    where s.id = automation_sequence_steps.sequence_id and s.organization_id = current_org_id() and is_manager()
  )) with check (exists (
    select 1 from automation_sequences s
    where s.id = automation_sequence_steps.sequence_id and s.organization_id = current_org_id() and is_manager()
  ));

-- Enrollments: los gestiona el trigger de negocio + el cron (service_role),
-- lectura para managers de la organización (ver en qué anda cada secuencia).
create policy "automation_sequence_enrollments_select" on automation_sequence_enrollments
  for select using (organization_id = current_org_id() and is_manager());

grant select, insert, update, delete on automation_sequences             to authenticated;
grant select, insert, update, delete on automation_sequence_steps        to authenticated;
grant select                          on automation_sequence_enrollments to authenticated;

-- ────────────────────────────────────────────────────────────────
-- Inscripción automática: se resuelve en la base, no en el código de
-- la app. Así funciona sin importar por dónde se cree o mueva el deal
-- (kanban, selector de etapa, webhooks, importación) — no depende de
-- que cada call site se acuerde de llamar a una función de inscripción.
-- ────────────────────────────────────────────────────────────────
create or replace function process_deal_sequences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq record;
begin
  -- El deal cambió de etapa, se cerró o se eliminó: cualquier secuencia
  -- activa sobre él deja de tener sentido — se insistiría sobre algo que
  -- ya avanzó o dejó de existir.
  if TG_OP = 'UPDATE' and (
    new.stage is distinct from old.stage
    or new.status is distinct from old.status
    or new.deleted_at is distinct from old.deleted_at
  ) then
    update automation_sequence_enrollments
      set status = 'stopped', stopped_reason = 'deal_changed', updated_at = now()
      where deal_id = new.id and status = 'active';
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    for v_seq in
      select id from automation_sequences
      where organization_id = new.organization_id and is_active = true and trigger_type = 'deal_created'
    loop
      insert into automation_sequence_enrollments (organization_id, sequence_id, deal_id, enrolled_stage, next_run_at)
      values (
        new.organization_id, v_seq.id, new.id, new.stage,
        now() + make_interval(hours => coalesce((select delay_hours from automation_sequence_steps where sequence_id = v_seq.id and step_order = 1), 0))
      )
      on conflict (sequence_id, deal_id) do nothing;
    end loop;
  end if;

  if (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and new.stage is distinct from old.stage)) then
    for v_seq in
      select id, trigger_config from automation_sequences
      where organization_id = new.organization_id and is_active = true and trigger_type = 'stage_change'
    loop
      if (v_seq.trigger_config->>'to_stage') = 'any' or (v_seq.trigger_config->>'to_stage') = new.stage then
        insert into automation_sequence_enrollments (organization_id, sequence_id, deal_id, enrolled_stage, next_run_at)
        values (
          new.organization_id, v_seq.id, new.id, new.stage,
          now() + make_interval(hours => coalesce((select delay_hours from automation_sequence_steps where sequence_id = v_seq.id and step_order = 1), 0))
        )
        on conflict (sequence_id, deal_id) do nothing;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_process_deal_sequences on deals;
create trigger trg_process_deal_sequences after insert or update on deals
  for each row execute function process_deal_sequences();

commit;
