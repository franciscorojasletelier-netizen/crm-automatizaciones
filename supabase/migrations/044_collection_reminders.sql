-- ============================================================
--  044 — Recordatorios automáticos de cobranza al cliente.
--
--  * collection_settings: por organización, apagado por defecto. Días
--    antes del vencimiento, el día del vencimiento y días de mora.
--  * invoice_reminders: registro de lo enviado (uno por documento y
--    hito), para que el cron diario nunca repita un aviso.
--  Lo envía /api/cron/collections con el correo del sistema (Resend).
-- ============================================================

create table if not exists collection_settings (
  organization_id  uuid primary key references organizations(id) on delete cascade,
  auto_reminders   boolean not null default false,
  days_before      int     not null default 3  check (days_before between 0 and 30),
  on_due_date      boolean not null default true,
  days_after       int[]   not null default '{7,15,30}'
                   check (array_length(days_after, 1) is null or array_length(days_after, 1) <= 6),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references profiles(id) on delete set null default auth.uid()
);

alter table collection_settings enable row level security;

drop policy if exists collection_settings_select on collection_settings;
create policy collection_settings_select on collection_settings
  for select to authenticated
  using (organization_id = current_org_id());

drop policy if exists collection_settings_write on collection_settings;
create policy collection_settings_write on collection_settings
  for all to authenticated
  using (organization_id = current_org_id() and is_collections_manager())
  with check (organization_id = current_org_id() and is_collections_manager());

revoke all on collection_settings from anon;
grant select, insert, update on collection_settings to authenticated;

create table if not exists invoice_reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id      uuid not null references invoices(id) on delete cascade,
  milestone       text not null,          -- 'antes', 'vence', 'mora_7', 'mora_15'…
  sent_to         text not null,
  sent_at         timestamptz not null default now(),
  unique (invoice_id, milestone)
);

create index if not exists invoice_reminders_org_idx on invoice_reminders (organization_id, sent_at desc);

alter table invoice_reminders enable row level security;

drop policy if exists invoice_reminders_select on invoice_reminders;
create policy invoice_reminders_select on invoice_reminders
  for select to authenticated
  using (organization_id = current_org_id() and is_collections_manager());

revoke all on invoice_reminders from anon;
grant select on invoice_reminders to authenticated;
-- Solo el cron (service_role) inserta.
