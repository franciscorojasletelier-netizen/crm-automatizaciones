-- ============================================================
--  040 — Cerrar escalamiento de privilegios en profiles.
--
--  1. "profiles_insert_self" permitía a CUALQUIER usuario autenticado
--     insertar su propio perfil con el rol y la organización que
--     quisiera. Con el registro público de Supabase Auth abierto (y
--     autoconfirmación de email), cualquiera con la clave publicable
--     podía registrarse y darse super_admin en una organización ajena
--     (el id de organización viaja, por ejemplo, en la respuesta pública
--     de una cotización). Todos los perfiles legítimos se crean en el
--     servidor con service_role (/api/admin/create-user,
--     /api/platform/create-organization), que no necesita esta policy.
--
--  2. "profiles_update_by_manager" dejaba a un gerente cambiar el rol de
--     cualquier usuario de su organización a super_admin, o desactivar a
--     un super_admin. La UI lo impedía; la base no. Ahora un trigger
--     aplica la misma regla que la UI:
--       - super_admin: puede asignar cualquier rol.
--       - gerente: solo roles operativos (comercial, producción, soporte,
--         finanzas) y no puede tocar perfiles de jefatura.
--       - nadie cambia su organización desde la app.
-- ============================================================

begin;

drop policy if exists "profiles_insert_self" on profiles;

create or replace function guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor text;
  v_leadership text[] := array['super_admin', 'admin', 'gerente'];
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'No se puede cambiar la organización de un usuario';
  end if;

  v_editor := current_user_role();

  if v_editor = 'gerente' and old.role::text = any(v_leadership) and old.id <> auth.uid() then
    raise exception 'Solo un Super Admin puede modificar usuarios de jefatura';
  end if;

  if new.role is distinct from old.role then
    if v_editor in ('super_admin', 'admin') then
      null;
    elsif v_editor = 'gerente' then
      if new.role::text = any(v_leadership) then
        raise exception 'Solo un Super Admin puede asignar roles de jefatura';
      end if;
    else
      raise exception 'Sin permiso para cambiar roles';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function guard_profile_privileges() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_privileges on profiles;
create trigger trg_guard_profile_privileges before update on profiles
  for each row execute function guard_profile_privileges();

commit;
