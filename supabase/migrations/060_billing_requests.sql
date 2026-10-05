-- 060 — Solicitudes de factura al contador
--
-- Cada vez que corresponde facturar una cuota (al aceptar la cotización, o
-- cuando el proyecto cruza el avance de la cuota) se registra una solicitud.
-- El cron de cada minuto (task-soon) la envía por correo al contador:
-- usuarios activos con rol Finanzas y/o el correo del contador externo de
-- la organización. Si no hay ninguno, la tarea del vendedor le recuerda
-- enviar los datos a su contador (botón "Enviar al contador").
--
-- Datos de facturación del cliente (los completa al firmar o en su ficha):
-- razón social, RUT, giro, dirección y correo para la factura.

alter table organizations add column if not exists accounting_email text;
alter table organizations drop constraint if exists organizations_accounting_email_check;
alter table organizations add constraint organizations_accounting_email_check
  check (accounting_email is null or accounting_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table companies add column if not exists legal_name text;
alter table companies add column if not exists tax_id text;
alter table companies add column if not exists business_activity text;
alter table companies add column if not exists billing_address text;
alter table companies add column if not exists billing_email text;

create table if not exists billing_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  deal_id         uuid references deals(id) on delete set null,
  quote_id        uuid references quotes(id) on delete set null,
  task_id         uuid references tasks(id) on delete set null,
  installment     int  not null default 1,
  installments    int  not null default 1,
  label           text,
  amount          numeric(16,2) not null,
  currency        text not null default 'CLP',
  status          text not null default 'pending' check (status in ('pending', 'sent', 'no_recipient', 'failed')),
  sent_to         text[],
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  unique (quote_id, installment)
);
create index if not exists idx_billing_requests_pending on billing_requests (status, created_at) where status = 'pending';
alter table billing_requests enable row level security;
drop policy if exists billing_requests_select on billing_requests;
create policy billing_requests_select on billing_requests for select to authenticated
  using (organization_id = current_org_id());
revoke insert, update, delete on billing_requests from anon, authenticated;
grant select on billing_requests to authenticated;

-- El avance del proyecto (059) también registra la solicitud de la cuota.
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
    continue when v_idx = 0;
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

    insert into billing_requests (organization_id, deal_id, quote_id, task_id, installment, installments, label, amount, currency)
    values (v_proj.organization_id, v_proj.deal_id, v_quote.id, v_task, v_idx + 1, v_n, v_label, (v_item ->> 'monto')::numeric, v_cur)
    on conflict (quote_id, installment) do nothing;

    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;
