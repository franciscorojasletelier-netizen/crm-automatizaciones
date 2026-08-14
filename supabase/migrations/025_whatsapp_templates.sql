-- ============================================================
--  FASE 5.4 — Plantillas de WhatsApp reutilizables.
--
--  WhatsApp es el canal principal de este CRM (no hay integración
--  de email) y hasta ahora cada mensaje se escribía desde cero.
--  Biblioteca de mensajes guardados por organización, con
--  placeholders simples ({{nombre}}) que se resuelven en el cliente
--  al insertar la plantilla.
-- ============================================================

begin;

create table if not exists whatsapp_templates (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id),
  name             text        not null,
  content          text        not null,
  created_by       uuid        references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_whatsapp_templates_org on whatsapp_templates(organization_id);

alter table whatsapp_templates enable row level security;

create or replace function set_org_whatsapp_templates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_org_whatsapp_templates on whatsapp_templates;
create trigger trg_org_whatsapp_templates before insert on whatsapp_templates
  for each row execute function set_org_whatsapp_templates();

-- Cualquiera de la organización puede leer y crear (es una biblioteca
-- compartida de mensajes, no datos sensibles). Editar/borrar solo el
-- propio autor o un manager — evita que un comercial borre la
-- plantilla que armó otro.
create policy "whatsapp_templates_select" on whatsapp_templates
  for select using (organization_id = current_org_id());

create policy "whatsapp_templates_insert" on whatsapp_templates
  for insert with check (organization_id = current_org_id() and auth.uid() is not null);

create policy "whatsapp_templates_update" on whatsapp_templates
  for update using (
    organization_id = current_org_id() and (is_manager() or created_by = auth.uid())
  ) with check (
    organization_id = current_org_id() and (is_manager() or created_by = auth.uid())
  );

create policy "whatsapp_templates_delete" on whatsapp_templates
  for delete using (
    organization_id = current_org_id() and (is_manager() or created_by = auth.uid())
  );

grant select, insert, update, delete on whatsapp_templates to authenticated;

commit;
