-- ============================================================
--  FASE 1.1 — Identidad de la organización.
--
--  organizations solo tenía id/name/is_active/max_users. No había
--  dónde guardar el teléfono, el email o el nombre comercial de un
--  cliente — por eso el mensaje de WhatsApp y los emails del sistema
--  tenían "Autopilot SpA" y un email escritos a mano en el código:
--  no es que estuvieran mal escritos, es que no existía el dato que
--  debían leer en su lugar.
--
--  display_name: nombre comercial que ve el cliente final (en el
--  mensaje de WhatsApp, en el pie de los emails). Puede diferir del
--  `name` interno que usa el dueño de la plataforma para identificar
--  la cuenta en /plataforma.
--  notification_email: dónde llegan los avisos internos del sistema
--  para ESA organización (antes era autopilotspa@gmail.com fijo).
--  default_country_code: prefijo telefónico (sin '+') usado para
--  normalizar números de WhatsApp — antes era '56' fijo en 3 archivos.
-- ============================================================

begin;

alter table organizations add column if not exists display_name text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists email text;
alter table organizations add column if not exists notification_email text;
alter table organizations add column if not exists address text;
alter table organizations add column if not exists country text not null default 'CL';
alter table organizations add column if not exists currency text not null default 'CLP';
alter table organizations add column if not exists timezone text not null default 'America/Santiago';
alter table organizations add column if not exists default_country_code text not null default '56';

-- Organizaciones existentes: sin display_name propio, se ve el `name`
-- interno hasta que el cliente lo configure — no rompe nada hoy.

-- ────────────────────────────────────────────────────────────────
-- Self-service: el super_admin de SU PROPIA organización puede
-- editar su identidad comercial, sin depender del dueño de la
-- plataforma para cambiar un teléfono o un logo.
-- ────────────────────────────────────────────────────────────────

drop policy if exists "organizations_update_by_own_admin" on organizations;
create policy "organizations_update_by_own_admin" on organizations
  for update
  using (id = current_org_id() and is_manager())
  with check (id = current_org_id() and is_manager());

-- Blindaje: is_active y max_users son palancas de plataforma
-- (suspensión, licenciamiento) — un super_admin cliente NO puede
-- tocarlas aunque la policy de arriba le permita hacer UPDATE sobre
-- la fila. Se aplica en un trigger porque RLS no puede restringir
-- por columna.
create or replace function guard_organization_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_platform_owner() then
    return new;
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'Solo el dueño de la plataforma puede activar/suspender una organización';
  end if;
  if new.max_users is distinct from old.max_users then
    raise exception 'Solo el dueño de la plataforma puede cambiar el límite de usuarios';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_organization_sensitive on organizations;
create trigger trg_guard_organization_sensitive
  before update on organizations
  for each row execute function guard_organization_sensitive_fields();

commit;
