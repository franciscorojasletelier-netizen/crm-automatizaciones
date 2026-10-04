-- 058 — Plan de pagos por hitos y aceptación con firma electrónica simple reforzada
--
-- * payment_terms: lista [{label, pct}] que suma 100 (p. ej. 50 % al inicio,
--   30 % al 70 % de avance, 20 % a la entrega). La organización define el
--   plan por defecto y cada cotización guarda el suyo.
-- * payment_conditions: texto de condiciones que el cliente acepta.
-- * Aceptación: RUT, cargo, correo verificado con código, navegador, copia
--   exacta de lo aceptado (accepted_snapshot) y su huella SHA-256.
-- * Una cotización respondida (aceptada o rechazada) ya no se puede modificar.
-- * quote_acceptance_codes: códigos de verificación por correo (solo servidor).

create or replace function valid_payment_terms(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'array'
     and jsonb_array_length(t) between 1 and 6
     and not exists (
       select 1 from jsonb_array_elements(t) e
        where jsonb_typeof(e->'pct') <> 'number'
           or (e->>'pct')::numeric <= 0 or (e->>'pct')::numeric > 100
           or coalesce(length(trim(e->>'label')), 0) not between 1 and 80
     )
     and (select sum((e->>'pct')::numeric) from jsonb_array_elements(t) e) = 100
$$;
revoke all on function valid_payment_terms(jsonb) from public, anon;
grant execute on function valid_payment_terms(jsonb) to authenticated, service_role;

alter table organizations add column if not exists payment_terms jsonb not null
  default '[{"label":"Al inicio","pct":50},{"label":"Al 70 % de avance","pct":30},{"label":"Entrega final (100 %)","pct":20}]';
alter table organizations add column if not exists payment_conditions text not null
  default 'Cada cuota se factura al cumplirse su hito. El inicio del trabajo queda sujeto al pago de la primera cuota.';
alter table organizations drop constraint if exists organizations_payment_terms_check;
alter table organizations add constraint organizations_payment_terms_check check (public.valid_payment_terms(payment_terms));
alter table organizations drop constraint if exists organizations_payment_conditions_len;
alter table organizations add constraint organizations_payment_conditions_len check (length(payment_conditions) <= 2000);

alter table quotes add column if not exists payment_terms jsonb;
alter table quotes add column if not exists payment_conditions text;
alter table quotes drop constraint if exists quotes_payment_terms_check;
alter table quotes add constraint quotes_payment_terms_check check (payment_terms is null or public.valid_payment_terms(payment_terms));
alter table quotes drop constraint if exists quotes_payment_conditions_len;
alter table quotes add constraint quotes_payment_conditions_len check (payment_conditions is null or length(payment_conditions) <= 2000);

alter table quotes add column if not exists sent_to_email text;
alter table quotes add column if not exists accepted_rut text;
alter table quotes add column if not exists accepted_role text;
alter table quotes add column if not exists accepted_email text;
alter table quotes add column if not exists accepted_user_agent text;
alter table quotes add column if not exists accepted_snapshot jsonb;
alter table quotes add column if not exists accepted_hash text;

-- Respondida = congelada (también para service_role).
create or replace function quotes_lock_answered() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status in ('accepted', 'rejected') and (
       new.status is distinct from old.status
    or new.items is distinct from old.items
    or new.taxes is distinct from old.taxes
    or new.currency is distinct from old.currency
    or new.payment_terms is distinct from old.payment_terms
    or new.payment_conditions is distinct from old.payment_conditions
    or new.valid_until is distinct from old.valid_until
    or new.notes is distinct from old.notes
    or new.accepted_at is distinct from old.accepted_at
    or new.accepted_by_name is distinct from old.accepted_by_name
    or new.accepted_rut is distinct from old.accepted_rut
    or new.accepted_email is distinct from old.accepted_email
    or new.accepted_snapshot is distinct from old.accepted_snapshot
    or new.accepted_hash is distinct from old.accepted_hash
    or new.rejected_at is distinct from old.rejected_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) then
    raise exception 'La cotización ya fue respondida por el cliente y no se puede modificar';
  end if;
  return new;
end;
$$;
drop trigger if exists quotes_lock_answered on quotes;
create trigger quotes_lock_answered before update on quotes
  for each row execute function quotes_lock_answered();

create table if not exists quote_acceptance_codes (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references quotes(id) on delete cascade,
  email        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_quote_acceptance_codes_quote on quote_acceptance_codes (quote_id, created_at desc);
alter table quote_acceptance_codes enable row level security;
revoke all on quote_acceptance_codes from anon, authenticated;
revoke all on function quotes_lock_answered() from public, anon, authenticated;
