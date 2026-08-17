-- ============================================================
--  FASE 8.2 — Cotizaciones generadas desde el CRM.
--
--  Hoy "propuesta" es solo subir un PDF externo. Esto agrega
--  cotizaciones reales armadas dentro del CRM (ítems, cantidades,
--  precios, IVA, total) — el momento exacto donde se cierra una
--  venta.
--
--  La tabla ya incluye los campos de la Fase 8.3 (firma electrónica
--  simple: link público, aceptar/rechazar con registro de fecha/IP)
--  para no tener que volver a migrar la misma tabla la próxima fase.
--  Los campos de aceptación no se usan todavía en esta fase.
-- ============================================================

begin;

create table if not exists quotes (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations(id),
  deal_id            uuid        not null references deals(id),
  quote_number       integer     not null, -- correlativo por organización, no global
  status             text        not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  currency           text        not null default 'CLP',
  items              jsonb       not null default '[]', -- [{description, quantity, unit_price}]
  tax_rate           numeric     not null default 19, -- IVA Chile por defecto, editable
  notes              text,
  valid_until        date,
  -- Fase 8.3 (firma electrónica simple) — reservado, sin lógica todavía.
  public_token       text        unique,
  sent_at            timestamptz,
  accepted_at        timestamptz,
  accepted_by_name   text,
  accepted_ip        text,
  rejected_at        timestamptz,
  created_by         uuid        references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create index if not exists idx_quotes_org  on quotes(organization_id);
create index if not exists idx_quotes_deal on quotes(deal_id);

alter table quotes enable row level security;

-- Correlativo por organización — no se puede resolver con una sequence
-- global de Postgres (esas son por columna, no por organization_id).
create or replace function set_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  if new.quote_number is null then
    select coalesce(max(quote_number), 0) + 1 into new.quote_number
    from quotes where organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_quote_number on quotes;
create trigger trg_set_quote_number before insert on quotes
  for each row execute function set_quote_number();

-- Mismo criterio de visibilidad que interactions/tasks: quien puede ver
-- el deal, puede ver sus cotizaciones.
create policy "quotes_select" on quotes
  for select using (organization_id = current_org_id() and can_see_deal(deal_id));

create policy "quotes_insert" on quotes
  for insert with check (organization_id = current_org_id() and auth.uid() is not null and can_see_deal(deal_id));

create policy "quotes_update" on quotes
  for update using (organization_id = current_org_id() and (is_manager() or created_by = auth.uid()));

grant select, insert, update on quotes to authenticated;

commit;
