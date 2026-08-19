-- ============================================================
--  FASE 9.2 — Email bidireccional (Gmail + Outlook).
--
--  Cada organización cliente registra SU PROPIA app OAuth interna
--  (Google Cloud / Entra ID) — evita la auditoría CASA anual que exige
--  Google para una app propia que use scopes restringidos de Gmail.
--  El client_id/client_secret de esa app van en platform_integrations,
--  mismo patrón que ya existe para Meta y WhatsApp.
--
--  email_accounts guarda el token OAuth de CADA VENDEDOR que conecta
--  su casilla. platform_integrations ya filtra el token por
--  organización pero lo deja legible para cualquier usuario de esa
--  organización (aceptable para el token de WhatsApp de la empresa;
--  inaceptable para el correo personal de un colega). Acá se cierra
--  ese hueco con GRANT a nivel de COLUMNA: `authenticated` puede leer
--  metadata de su fila, nunca los tokens — esos son de uso exclusivo
--  de service_role.
-- ============================================================

begin;

alter table platform_integrations drop constraint if exists platform_integrations_provider_check;
alter table platform_integrations add constraint platform_integrations_provider_check
  check (provider in ('meta_leads', 'whatsapp', 'webhook_form', 'google_workspace', 'microsoft_365'));
-- external_id = client_id de la app OAuth del cliente; access_token = client_secret.
-- Mismo par de columnas que ya usan los demás providers, sin agregar nada nuevo.

-- Gmail necesita, además del OAuth, un tema de Pub/Sub del propio
-- proyecto de Google Cloud del cliente (watch() no funciona solo con
-- client_id/secret) — se guarda acá en vez de forzar un tercer par de
-- columnas genéricas. No se usa para ningún otro provider hoy.
alter table platform_integrations add column if not exists config jsonb not null default '{}';

create table if not exists email_accounts (
  id                       uuid        primary key default gen_random_uuid(),
  organization_id          uuid        not null references organizations(id) on delete cascade,
  user_id                  uuid        not null references profiles(id) on delete cascade,
  provider                 text        not null check (provider in ('google_workspace', 'microsoft_365')),
  email_address            text        not null,
  access_token             text,
  refresh_token            text,
  token_expires_at         timestamptz,
  -- Gmail: historyId, cursor de sincronización incremental — de acá
  -- arranca la siguiente reconciliación. Outlook no lo necesita para
  -- sincronizar (la notificación de Graph ya trae el ID del mensaje
  -- directo, sin history/delta de por medio); acá guarda en cambio el
  -- clientState — el secreto que el webhook usa para confirmar que la
  -- notificación entrante viene de ESTA suscripción y no de un tercero.
  sync_cursor              text,
  -- Outlook: id real de la suscripción de Graph. Gmail no tiene
  -- concepto de suscripción — el watch() se re-arma directo con el
  -- token, por eso queda nulo para ese proveedor.
  subscription_id          text,
  subscription_expires_at  timestamptz,
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, user_id, provider, email_address)
);

create index if not exists idx_email_accounts_org on email_accounts (organization_id);
create index if not exists idx_email_accounts_subscription_expiry on email_accounts (subscription_expires_at) where is_active;

alter table email_accounts enable row level security;

create policy "email_accounts_select" on email_accounts
  for select using (user_id = auth.uid() or is_platform_owner());

create policy "email_accounts_delete" on email_accounts
  for delete using (user_id = auth.uid() or is_platform_owner());

-- Sin política de insert/update para `authenticated`: con RLS activo y
-- ninguna policy permisiva, esas operaciones quedan denegadas para ese
-- rol aunque alguien intente saltarse el GRANT de columnas. El alta
-- (con tokens) y el refresh solo los hace la ruta de callback OAuth y
-- el cron de renovación, ambos con service_role.

grant select (id, organization_id, user_id, provider, email_address, is_active, created_at, updated_at) on email_accounts to authenticated;
grant delete on email_accounts to authenticated;
grant all on email_accounts to service_role;

create table if not exists email_messages (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null references organizations(id) on delete cascade,
  -- Nullable a propósito: si el remitente/destinatario no matchea
  -- ningún contacto, el mensaje se guarda igual (a diferencia de
  -- whatsapp_messages, que hoy lo descarta silenciosamente).
  deal_id             uuid        references deals(id) on delete cascade,
  contact_id          uuid        references contacts(id) on delete set null,
  email_account_id    uuid        not null references email_accounts(id) on delete cascade,
  direction           text        not null check (direction in ('inbound', 'outbound')),
  subject             text,
  body_text           text,
  body_html           text,
  from_address         text        not null,
  to_addresses        text[]      not null default '{}',
  provider_message_id text,
  thread_id           text,
  sent_at             timestamptz not null,
  created_at           timestamptz not null default now()
);

create index if not exists idx_email_messages_deal on email_messages (deal_id, sent_at);
create index if not exists idx_email_messages_org on email_messages (organization_id);
create index if not exists idx_email_messages_thread on email_messages (thread_id);

alter table email_messages enable row level security;

-- Mismo nivel de rigor que whatsapp_messages (rol/dueño/miembro del
-- deal), extendido para el caso deal_id nulo: ahí solo lo ve gerencia
-- (es material de triage, no algo que cada comercial deba revisar).
create policy "email_messages_select" on email_messages
  for select using (
    is_platform_owner()
    or (
      deal_id is not null and exists (
        select 1 from deals d
        join profiles p on p.id = auth.uid()
        where d.id = email_messages.deal_id
          and (
            p.role in ('super_admin','admin','gerente')
            or d.owner_id = auth.uid()
            or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid())
          )
      )
    )
    or (
      deal_id is null and organization_id = current_org_id() and exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','gerente')
      )
    )
  );

-- Sin policy de insert para `authenticated`: tanto el ingreso por
-- webhook (inbound) como el envío desde el CRM (outbound) necesitan
-- leer el token de email_accounts para hablar con Gmail/Graph, y ese
-- token es ilegible para `authenticated` — el insert siempre lo hace
-- la ruta correspondiente con service_role.

grant select on email_messages to authenticated;
grant all on email_messages to service_role;

commit;
