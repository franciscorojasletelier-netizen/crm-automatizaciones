-- ============================================================
--  045 — Plan comercial por organización (SaaS).
--
--  El plan es una etiqueta + valores por defecto: al asignarlo, la app
--  ajusta max_users y los módulos (src/lib/plans.ts). 'personalizado'
--  conserva lo que se haya configurado a mano.
-- ============================================================
alter table organizations add column if not exists plan text not null default 'personalizado';

alter table organizations drop constraint if exists organizations_plan_check;
alter table organizations add constraint organizations_plan_check
  check (plan in ('basico', 'profesional', 'empresa', 'personalizado'));

-- La organización dueña de la plataforma usa todo.
update organizations o set plan = 'empresa'
 where exists (select 1 from profiles p join platform_owners po on po.user_id = p.id where p.organization_id = o.id);

-- Solo el dueño de la plataforma (o el servidor con service_role, que
-- aplica los planes) cambia plan, límite, estado o MFA.
create or replace function guard_organization_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_platform_owner() or auth.role() = 'service_role' then
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
  if new.plan is distinct from old.plan then
    raise exception 'Solo el dueño de la plataforma puede cambiar el plan';
  end if;
  return new;
end;
$$;
