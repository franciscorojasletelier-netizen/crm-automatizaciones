-- 051 — Monedas (CLP, USD, EUR) e impuestos configurables
--
-- * organizations.currency es la moneda base de la organización: con ella
--   se muestran deals, pipeline, reportes y toda la cobranza. Las facturas
--   la heredan siempre (un estado de cuenta nunca mezcla monedas), y no se
--   puede cambiar una vez que hay documentos de cobranza.
-- * Una cotización puede ir en otra moneda (cliente extranjero): no se suma
--   con otras.
-- * Impuestos: lista [{label, rate}] (p. ej. IVA 19 % + impuesto adicional),
--   cada uno sobre el subtotal. La organización define los por defecto y
--   cada cotización guarda los suyos.
-- * USD/EUR llevan centavos: los montos de cobranza pasan a 2 decimales
--   (los valores CLP existentes no cambian).

-- ── Moneda ────────────────────────────────────────────────────
alter table organizations drop constraint if exists organizations_currency_check;
alter table organizations add constraint organizations_currency_check check (currency in ('CLP', 'USD', 'EUR'));
alter table quotes drop constraint if exists quotes_currency_check;
alter table quotes add constraint quotes_currency_check check (currency in ('CLP', 'USD', 'EUR'));
alter table invoices drop constraint if exists invoices_currency_check;
alter table invoices add constraint invoices_currency_check check (currency in ('CLP', 'USD', 'EUR'));

alter table invoices         alter column amount      type numeric(16,2);
alter table invoices         alter column paid_amount type numeric(16,2);
alter table invoice_payments alter column amount      type numeric(16,2);

-- ── Impuestos ─────────────────────────────────────────────────
create or replace function valid_taxes(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'array'
     and jsonb_array_length(t) <= 5
     and not exists (
       select 1 from jsonb_array_elements(t) e
        where jsonb_typeof(e->'rate') <> 'number'
           or (e->>'rate')::numeric < 0 or (e->>'rate')::numeric > 100
           or coalesce(length(trim(e->>'label')), 0) not between 1 and 40
     )
$$;

alter table organizations add column if not exists taxes jsonb not null default '[{"label":"IVA","rate":19}]';
alter table organizations drop constraint if exists organizations_taxes_check;
alter table organizations add constraint organizations_taxes_check check (public.valid_taxes(taxes));

alter table quotes add column if not exists taxes jsonb;
update quotes set taxes = case when coalesce(tax_rate, 0) > 0
  then jsonb_build_array(jsonb_build_object('label', 'IVA', 'rate', tax_rate))
  else '[]'::jsonb end
 where taxes is null;
alter table quotes alter column taxes set default '[{"label":"IVA","rate":19}]';
alter table quotes alter column taxes set not null;
alter table quotes drop constraint if exists quotes_taxes_check;
alter table quotes add constraint quotes_taxes_check check (public.valid_taxes(taxes));
comment on column quotes.tax_rate is 'Obsoleto desde 051: usar taxes. Se mantiene con la suma de las tasas.';

-- tax_rate queda como la suma de las tasas (compatibilidad con lecturas antiguas).
create or replace function quotes_sync_tax_rate() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.tax_rate := coalesce((select sum((e->>'rate')::numeric) from jsonb_array_elements(new.taxes) e), 0);
  return new;
end;
$$;
drop trigger if exists quotes_sync_tax_rate on quotes;
create trigger quotes_sync_tax_rate before insert or update of taxes on quotes
  for each row execute function quotes_sync_tax_rate();

-- ── Facturas: siempre en la moneda de la organización ─────────
create or replace function invoices_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' or new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  if new.organization_id is null then
    raise exception 'No se pudo determinar la organización del documento';
  end if;
  perform pg_advisory_xact_lock(hashtext('invoice_number:' || new.organization_id::text));
  select coalesce(max(invoice_number), 0) + 1 into new.invoice_number
    from invoices where organization_id = new.organization_id;
  select currency into new.currency from organizations where id = new.organization_id;
  new.paid_amount := 0;
  new.status := 'pendiente';
  return new;
end;
$$;

create or replace function invoices_keep_currency() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.currency := old.currency;
  return new;
end;
$$;
drop trigger if exists invoices_keep_currency on invoices;
create trigger invoices_keep_currency before update of currency on invoices
  for each row execute function invoices_keep_currency();

-- ── La moneda base no cambia si ya hay cobranza ───────────────
create or replace function organizations_guard_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.currency is distinct from old.currency
     and exists (select 1 from invoices where organization_id = old.id and status <> 'anulada') then
    raise exception 'No se puede cambiar la moneda: la organización ya tiene documentos de cobranza en %', old.currency;
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_guard_currency on organizations;
create trigger organizations_guard_currency before update of currency on organizations
  for each row execute function organizations_guard_currency();

revoke all on function valid_taxes(jsonb), quotes_sync_tax_rate(), invoices_keep_currency(), organizations_guard_currency() from public, anon;
-- valid_taxes la evalúan los CHECK con el rol de quien escribe.
grant execute on function valid_taxes(jsonb) to authenticated, service_role;
