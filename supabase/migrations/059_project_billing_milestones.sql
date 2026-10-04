-- 059 — Avance del proyecto conectado con el plan de pagos
--
-- Cuando un proyecto cruza el avance que dispara una cuota (p. ej. 70 %, o
-- la entrega = 100 %), se crea la tarea "Emitir factura cuota N" para el
-- responsable del deal, con su monto, y un aviso. Una sola vez por cuota.
-- La cuota 1 (al aceptar) la agenda la aceptación de la cotización.
--
-- Avance = % de entregables completados; entregado = 100 %.
-- El disparador de cada cuota sale de la copia aceptada (avance), del plan
-- de la cotización (at) o, en planes antiguos, del texto del hito.

create table if not exists project_billing_milestones (
  project_id  uuid not null references projects(id) on delete cascade,
  installment int  not null,
  quote_id    uuid references quotes(id) on delete set null,
  task_id     uuid references tasks(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (project_id, installment)
);
alter table project_billing_milestones enable row level security;
revoke all on project_billing_milestones from anon, authenticated;

-- "Próximas horas hábiles" (lun–vie 9–18 Chile): dentro, +2 h; fuera, siguiente día hábil 10:00.
create or replace function next_business_due(ts timestamptz default now()) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  l timestamp := ts at time zone 'America/Santiago';
  d date;
begin
  if extract(isodow from l) <= 5 and extract(hour from l) >= 9 and extract(hour from l) < 16 then
    return ts + interval '2 hours';
  end if;
  d := l::date + case when extract(isodow from l) <= 5 and extract(hour from l) < 9 then 0 else 1 end;
  while extract(isodow from d) in (6, 7) loop d := d + 1; end loop;
  return (d + time '10:00') at time zone 'America/Santiago';
end;
$$;

-- Monto con el formato de la moneda (CLP sin decimales).
create or replace function fmt_money(m numeric, cur text) returns text
language sql immutable set search_path = '' as $$
  select case coalesce(cur, 'CLP')
    when 'CLP' then '$' || replace(to_char(round(m), 'FM999,999,999,990'), ',', '.')
    when 'USD' then 'US$' || translate(to_char(m, 'FM999,999,999,990.00'), ',.', '.,')
    else '€' || translate(to_char(m, 'FM999,999,999,990.00'), ',.', '.,')
  end
$$;

create or replace function check_project_billing(p_project_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_proj record;
  v_quote record;
  v_total int; v_done int; v_progress numeric;
  v_item jsonb; v_idx int; v_at numeric; v_label text; v_n int;
  v_assignee uuid; v_task uuid; v_created int := 0; v_cur text; v_amount text;
begin
  select p.id, p.deal_id, p.organization_id, p.status, p.delivered_at, p.owner_id, d.owner_id as deal_owner, c.name as company
    into v_proj
    from projects p left join deals d on d.id = p.deal_id left join companies c on c.id = p.company_id
   where p.id = p_project_id;
  if not found or v_proj.deal_id is null then return 0; end if;
  -- Llamada desde la app: solo proyectos de la propia organización.
  if auth.role() <> 'service_role' and current_org_id() is distinct from v_proj.organization_id then return 0; end if;

  select id, quote_number, accepted_snapshot, payment_terms into v_quote
    from quotes
   where deal_id = v_proj.deal_id and status = 'accepted' and accepted_snapshot is not null
   order by accepted_at desc limit 1;
  if not found then return 0; end if;

  if v_proj.status = 'entregado' or v_proj.delivered_at is not null then
    v_progress := 100;
  else
    select count(*), count(*) filter (where is_completed) into v_total, v_done
      from project_deliverables where project_id = p_project_id;
    v_progress := case when v_total > 0 then v_done * 100.0 / v_total else 0 end;
  end if;

  v_assignee := coalesce(v_proj.deal_owner, v_proj.owner_id);
  if v_assignee is null then return 0; end if;
  v_cur := coalesce(v_quote.accepted_snapshot #>> '{documento,moneda}', 'CLP');
  v_n := jsonb_array_length(coalesce(v_quote.accepted_snapshot -> 'plan_de_pagos', '[]'::jsonb));

  for v_item, v_idx in
    select e, (ord - 1)::int from jsonb_array_elements(coalesce(v_quote.accepted_snapshot -> 'plan_de_pagos', '[]'::jsonb)) with ordinality as t(e, ord)
  loop
    continue when v_idx = 0; -- la cuota 1 se agenda al aceptar
    v_label := coalesce(v_item ->> 'hito', '');
    v_at := coalesce(
      nullif(v_item ->> 'avance', '')::numeric,
      nullif(v_quote.payment_terms -> v_idx ->> 'at', '')::numeric,
      case when lower(v_label) ~ '\d+\s*%\s*(de\s*)?avance' then least(100, substring(lower(v_label) from '(\d+)\s*%')::numeric)
           when lower(v_label) ~ 'entrega|final' then 100 end);
    continue when v_at is null or v_progress < v_at;
    continue when exists (select 1 from project_billing_milestones where project_id = p_project_id and installment = v_idx + 1);

    v_amount := fmt_money((v_item ->> 'monto')::numeric, v_cur);
    insert into tasks (organization_id, deal_id, assigned_to, created_by, title, description, due_date)
    values (
      v_proj.organization_id, v_proj.deal_id, v_assignee, v_assignee,
      format('Emitir factura cuota %s — Cotización #%s%s', v_idx + 1, v_quote.quote_number, coalesce(' (' || v_proj.company || ')', '')),
      format('Cuota %s de %s (%s, %s %%): %s.%sEl proyecto alcanzó %s %% de avance.',
        v_idx + 1, v_n, v_label, v_item ->> 'porcentaje', v_amount, E'\n', round(v_progress)),
      next_business_due(now())
    ) returning id into v_task;

    insert into notifications (user_id, type, title, body, entity_type, entity_id)
    values (v_assignee, 'billing_milestone',
      format('Emitir factura cuota %s — %s', v_idx + 1, coalesce(v_proj.company, 'Proyecto')),
      format('El proyecto llegó a %s %% de avance: corresponde la cuota %s (%s): %s.', round(v_progress), v_idx + 1, v_label, v_amount),
      'deal', v_proj.deal_id);

    insert into project_billing_milestones (project_id, installment, quote_id, task_id)
    values (p_project_id, v_idx + 1, v_quote.id, v_task);
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

create or replace function trg_deliverables_billing() returns trigger
language plpgsql set search_path = public as $$
begin
  perform check_project_billing(coalesce(new.project_id, old.project_id));
  return null;
end;
$$;
drop trigger if exists deliverables_billing on project_deliverables;
create trigger deliverables_billing after insert or delete or update of is_completed on project_deliverables
  for each row execute function trg_deliverables_billing();

create or replace function trg_projects_billing() returns trigger
language plpgsql set search_path = public as $$
begin
  perform check_project_billing(new.id);
  return null;
end;
$$;
drop trigger if exists projects_billing on projects;
create trigger projects_billing after update of status, delivered_at on projects
  for each row execute function trg_projects_billing();

revoke all on function check_project_billing(uuid), next_business_due(timestamptz), fmt_money(numeric, text) from public, anon;
grant execute on function check_project_billing(uuid), next_business_due(timestamptz), fmt_money(numeric, text) to authenticated, service_role;
revoke all on function trg_deliverables_billing(), trg_projects_billing() from public, anon, authenticated;
