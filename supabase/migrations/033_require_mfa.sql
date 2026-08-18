-- ============================================================
--  FASE 9.1 — Doble factor (TOTP).
--
--  require_mfa: palanca de PLATAFORMA, igual que is_active y
--  max_users — solo el dueño de la plataforma puede exigirle 2FA a
--  una organización cliente. Se suma a la misma lista blindada por
--  guard_organization_sensitive_fields() (019) para que un
--  super_admin cliente no pueda desactivárselo a sí mismo.
-- ============================================================

begin;

alter table organizations add column if not exists require_mfa boolean not null default false;

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
  if new.require_mfa is distinct from old.require_mfa then
    raise exception 'Solo el dueño de la plataforma puede exigir doble factor';
  end if;
  return new;
end;
$$;

commit;
