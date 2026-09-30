-- ============================================================
--  038 — Módulo de Cobranza.
--
--  Cierra el ciclo comercial: deal ganado → proyecto → documento por
--  cobrar → pagos. Tres tablas:
--
--  invoices            documento por cobrar (factura, boleta, nota de
--                      cobro). Montos en CLP enteros.
--  invoice_payments    pagos/abonos. El saldo y el estado del documento
--                      los mantiene la BASE (trigger), nunca el cliente:
--                      así no hay forma de que la UI deje un documento
--                      "pagado" con saldo, o viceversa.
--  invoice_activities  gestiones de cobranza (llamada, email, compromiso
--                      de pago con fecha).
--
--  "Vencida" NO es un estado guardado: es pendiente/parcial con
--  due_date < hoy (hora de Chile). Guardarlo obligaría a un cron que lo
--  actualice y quedaría desfasado entre corridas.
--
--  Visibilidad: gerencia ve todo; un comercial ve los documentos de
--  deals que puede ver o de los que es responsable. Solo gerencia crea,
--  edita, anula y registra pagos; quien ve un documento puede registrar
--  gestiones.
-- ============================================================

begin;

-- ── Documentos por cobrar ─────────────────────────────────────
create table if not exists invoices (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  invoice_number   integer     not null,  -- correlativo interno por organización
  company_id       uuid        not null references companies(id),
  deal_id          uuid        references deals(id)    on delete set null,
  project_id       uuid        references projects(id) on delete set null,
  quote_id         uuid        references quotes(id)   on delete set null,
  document_type    text        not null default 'factura'
                   check (document_type in ('factura', 'boleta', 'nota_cobro', 'otro')),
  document_folio   text,                   -- folio SII u otro número externo
  description      text        not null check (length(trim(description)) > 0),
  amount           numeric(14,0) not null check (amount > 0),
  paid_amount      numeric(14,0) not null default 0 check (paid_amount >= 0),
  currency         text        not null default 'CLP',
  issue_date       date        not null default ((now() at time zone 'America/Santiago')::date),
  due_date         date        not null,
  status           text        not null default 'pendiente'
                   check (status in ('pendiente', 'parcial', 'pagada', 'anulada')),
  responsible_id   uuid        references profiles(id) on delete set null,
  notes            text,
  next_promise_date date,                  -- último compromiso de pago registrado
  last_activity_at timestamptz,
  cancelled_reason text,
  cancelled_at     timestamptz,
  created_by       uuid        references profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, invoice_number),
  check (paid_amount <= amount),
  check (due_date >= issue_date)
);

create index if not exists idx_invoices_org_status on invoices (organization_id, status, due_date);
create index if not exists idx_invoices_company    on invoices (company_id);
create index if not exists idx_invoices_deal       on invoices (deal_id);
create index if not exists idx_invoices_responsible on invoices (responsible_id);

-- ── Pagos ─────────────────────────────────────────────────────
create table if not exists invoice_payments (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  invoice_id       uuid        not null references invoices(id) on delete cascade,
  amount           numeric(14,0) not null check (amount > 0),
  paid_on          date        not null default ((now() at time zone 'America/Santiago')::date),
  method           text        not null default 'transferencia'
                   check (method in ('transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro')),
  reference        text,
  notes            text,
  created_by       uuid        references profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice on invoice_payments (invoice_id);
create index if not exists idx_invoice_payments_org_date on invoice_payments (organization_id, paid_on);

-- ── Gestiones de cobranza ─────────────────────────────────────
create table if not exists invoice_activities (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  invoice_id       uuid        not null references invoices(id) on delete cascade,
  kind             text        not null
                   check (kind in ('llamada', 'email', 'whatsapp', 'reunion', 'compromiso', 'nota')),
  notes            text        not null check (length(trim(notes)) > 0),
  promise_date     date,
  promise_amount   numeric(14,0) check (promise_amount is null or promise_amount > 0),
  created_by       uuid        references profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  check (kind <> 'compromiso' or promise_date is not null)
);

create index if not exists idx_invoice_activities_invoice on invoice_activities (invoice_id, created_at desc);

-- ── Triggers ──────────────────────────────────────────────────

-- Documento nuevo: organización forzada a la de la sesión (salvo
-- service_role, que la trae explícita) y correlativo por organización.
create or replace function invoices_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  if new.organization_id is null then
    raise exception 'No se pudo determinar la organización del documento';
  end if;
  -- Serializa la numeración dentro de la organización.
  perform pg_advisory_xact_lock(hashtext('invoice_number:' || new.organization_id::text));
  select coalesce(max(invoice_number), 0) + 1 into new.invoice_number
    from invoices where organization_id = new.organization_id;
  new.paid_amount := 0;
  new.status := 'pendiente';
  return new;
end;
$$;

drop trigger if exists trg_invoices_before_insert on invoices;
create trigger trg_invoices_before_insert before insert on invoices
  for each row execute function invoices_before_insert();

-- Edición: saldo y estado son derivados. Desde la app solo se puede
-- anular (status = 'anulada'); paid_amount solo lo mueve el trigger de
-- pagos (pg_trigger_depth() > 1).
create or replace function invoices_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.organization_id := old.organization_id;
  new.invoice_number := old.invoice_number;

  if pg_trigger_depth() <= 1 then
    new.paid_amount := old.paid_amount;
  end if;

  if old.status = 'anulada' and new.status <> 'anulada' then
    raise exception 'Un documento anulado no se puede reactivar';
  end if;

  if new.status = 'anulada' then
    if old.status <> 'anulada' then
      if old.paid_amount > 0 then
        raise exception 'No se puede anular un documento con pagos registrados. Elimina primero los pagos.';
      end if;
      new.cancelled_at := now();
    end if;
    return new;
  end if;

  if new.amount < new.paid_amount then
    raise exception 'El monto no puede quedar bajo lo ya pagado (%)', new.paid_amount;
  end if;

  new.status := case
    when new.paid_amount >= new.amount then 'pagada'
    when new.paid_amount > 0 then 'parcial'
    else 'pendiente'
  end;
  return new;
end;
$$;

drop trigger if exists trg_invoices_before_update on invoices;
create trigger trg_invoices_before_update before update on invoices
  for each row execute function invoices_before_update();

-- Pago nuevo: hereda la organización del documento y no puede superar
-- el saldo ni caer sobre un documento anulado.
create or replace function invoice_payments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invoices%rowtype;
begin
  select * into v_inv from invoices where id = new.invoice_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if auth.role() <> 'service_role' and v_inv.organization_id is distinct from current_org_id() then
    raise exception 'Documento no encontrado';
  end if;
  if v_inv.status = 'anulada' then
    raise exception 'No se pueden registrar pagos en un documento anulado';
  end if;
  if new.amount > v_inv.amount - v_inv.paid_amount then
    raise exception 'El pago (%) supera el saldo pendiente (%)', new.amount, v_inv.amount - v_inv.paid_amount;
  end if;
  new.organization_id := v_inv.organization_id;
  return new;
end;
$$;

drop trigger if exists trg_invoice_payments_before_insert on invoice_payments;
create trigger trg_invoice_payments_before_insert before insert on invoice_payments
  for each row execute function invoice_payments_before_insert();

-- Recalcula saldo (y por el trigger de update, el estado) tras cada
-- pago agregado o eliminado.
create or replace function invoice_payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update invoices
     set paid_amount = (select coalesce(sum(amount), 0) from invoice_payments where invoice_id = v_invoice_id)
   where id = v_invoice_id and status <> 'anulada';
  return null;
end;
$$;

drop trigger if exists trg_invoice_payments_after_change on invoice_payments;
create trigger trg_invoice_payments_after_change after insert or delete on invoice_payments
  for each row execute function invoice_payments_after_change();

-- Gestión nueva: hereda organización; actualiza última gestión y, si
-- es un compromiso, la próxima fecha comprometida.
create or replace function invoice_activities_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from invoices where id = new.invoice_id;
  if v_org is null or (auth.role() <> 'service_role' and v_org is distinct from current_org_id()) then
    raise exception 'Documento no encontrado';
  end if;
  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists trg_invoice_activities_before_insert on invoice_activities;
create trigger trg_invoice_activities_before_insert before insert on invoice_activities
  for each row execute function invoice_activities_before_insert();

create or replace function invoice_activities_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices
     set last_activity_at = new.created_at,
         next_promise_date = case when new.kind = 'compromiso' then new.promise_date else next_promise_date end
   where id = new.invoice_id;
  return null;
end;
$$;

drop trigger if exists trg_invoice_activities_after_insert on invoice_activities;
create trigger trg_invoice_activities_after_insert after insert on invoice_activities
  for each row execute function invoice_activities_after_insert();

-- Nadie invoca estas funciones directo (ver 037).
revoke all on function invoices_before_insert()             from public, anon, authenticated;
revoke all on function invoices_before_update()             from public, anon, authenticated;
revoke all on function invoice_payments_before_insert()     from public, anon, authenticated;
revoke all on function invoice_payments_after_change()      from public, anon, authenticated;
revoke all on function invoice_activities_before_insert()   from public, anon, authenticated;
revoke all on function invoice_activities_after_insert()    from public, anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────
alter table invoices           enable row level security;
alter table invoice_payments   enable row level security;
alter table invoice_activities enable row level security;

drop policy if exists "invoices_select" on invoices;
create policy "invoices_select" on invoices for select using (
  organization_id = current_org_id() and (
    is_manager()
    or responsible_id = auth.uid()
    or (deal_id is not null and can_see_deal(deal_id))
  )
);

drop policy if exists "invoices_insert" on invoices;
create policy "invoices_insert" on invoices for insert
  with check (organization_id = current_org_id() and is_manager());

drop policy if exists "invoices_update" on invoices;
create policy "invoices_update" on invoices for update
  using (organization_id = current_org_id() and is_manager())
  with check (organization_id = current_org_id() and is_manager());

-- Los hijos se ven si el documento se ve (el subselect pasa por la RLS
-- de invoices con el rol del usuario).
drop policy if exists "invoice_payments_select" on invoice_payments;
create policy "invoice_payments_select" on invoice_payments for select using (
  organization_id = current_org_id() and exists (select 1 from invoices i where i.id = invoice_id)
);

drop policy if exists "invoice_payments_insert" on invoice_payments;
create policy "invoice_payments_insert" on invoice_payments for insert
  with check (is_manager() and exists (select 1 from invoices i where i.id = invoice_id));

drop policy if exists "invoice_payments_delete" on invoice_payments;
create policy "invoice_payments_delete" on invoice_payments for delete
  using (organization_id = current_org_id() and is_manager());

drop policy if exists "invoice_activities_select" on invoice_activities;
create policy "invoice_activities_select" on invoice_activities for select using (
  organization_id = current_org_id() and exists (select 1 from invoices i where i.id = invoice_id)
);

drop policy if exists "invoice_activities_insert" on invoice_activities;
create policy "invoice_activities_insert" on invoice_activities for insert
  with check (auth.uid() is not null and exists (select 1 from invoices i where i.id = invoice_id));

grant select, insert, update on invoices           to authenticated;
grant select, insert, delete on invoice_payments   to authenticated;
grant select, insert         on invoice_activities to authenticated;
grant all on invoices, invoice_payments, invoice_activities to service_role;

-- ── Módulo habilitable por organización ───────────────────────
-- Lectura fail-open: sin fila = habilitado. Se agrega a la siembra de
-- organizaciones nuevas para que aparezca explícito en el panel.
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
      'automatizaciones','actividad','usuarios','configuracion','cobranza'
    ]) as m
  on conflict (organization_id, module_key) do nothing;
end;
$$;

revoke all on function seed_default_modules(uuid) from public, anon, authenticated;
grant execute on function seed_default_modules(uuid) to service_role;

-- ── Aviso diario de cobranza ──────────────────────────────────
-- 12:30 UTC = 08:30/09:30 en Chile, después del resumen de tareas.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cron-collections';
    perform cron.schedule('cron-collections', '30 12 * * *', $cron$select cron_call('/api/cron/collections')$cron$);
  end if;
end;
$$;

commit;
