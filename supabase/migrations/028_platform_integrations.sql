-- ============================================================
--  Rediseño de resolución de organización en webhooks (Fase 7,
--  punto pendiente): antes, TODOS los webhooks de leads resolvían
--  el tenant vía una sola variable de entorno global
--  (WEBHOOK_DEFAULT_ORG_EMAIL) y WhatsApp usaba un solo
--  WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN para toda la
--  instalación. Funcionaba porque solo hay un cliente real hoy,
--  pero en cuanto exista un segundo con su propia integración de
--  Meta/WhatsApp, sus leads/mensajes se habrían enrutado mal.
--
--  Esta tabla mapea cada integración externa (identificada por lo
--  que Meta/WhatsApp realmente manda en el payload — page_id,
--  phone_number_id — o un token propio para el webhook de
--  formulario web, que no tiene un identificador de terceros) a
--  UNA organización. Solo el dueño de la plataforma la administra
--  — mismo patrón que pipeline_stages/field_definitions/
--  organization_modules.
-- ============================================================

begin;

create table if not exists platform_integrations (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  provider         text        not null check (provider in ('meta_leads', 'whatsapp', 'webhook_form')),
  -- meta_leads: Page ID de Meta (entry[].id del payload del webhook)
  -- whatsapp:   phone_number_id (value.metadata.phone_number_id)
  -- webhook_form: un slug propio, sin significado fuera de esta tabla
  external_id      text        not null,
  -- meta_leads: page access token para leer el lead vía Graph API
  -- whatsapp:   access token de WhatsApp Cloud API
  -- webhook_form: el secreto que el formulario del cliente manda como Bearer token
  access_token     text,
  label            text,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists idx_platform_integrations_org on platform_integrations(organization_id);

alter table platform_integrations enable row level security;

-- Mismo criterio que pipeline_stages: SELECT para la propia organización
-- o el dueño de la plataforma; escritura SOLO el dueño de la plataforma.
create policy "platform_integrations_select" on platform_integrations
  for select using (organization_id = current_org_id() or is_platform_owner());

create policy "platform_integrations_manage" on platform_integrations
  for all using (is_platform_owner()) with check (is_platform_owner());

grant select, insert, update, delete on platform_integrations to authenticated;

commit;
