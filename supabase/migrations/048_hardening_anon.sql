-- ============================================================
--  048 — Endurecimiento de privilegios (auditoría 2026-10-03).
--
--  * anon (cualquiera con la clave publicable) tenía SELECT en deals,
--    companies y contacts; INSERT/SELECT/DELETE en team_messages y
--    TRUNCATE/TRIGGER/REFERENCES en todas las tablas. La RLS lo bloqueaba
--    igual, pero no hay ningún flujo que use la base sin sesión: las
--    rutas públicas (cotización, webhooks) usan service_role en el
--    servidor. Se revoca todo a anon.
--  * authenticated no necesita TRUNCATE/TRIGGER/REFERENCES (TRUNCATE no
--    pasa por RLS).
--  * Las tablas/funciones nuevas ya no heredan permisos para anon.
--  * search_path fijo en las dos funciones que no lo tenían.
-- ============================================================

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

revoke truncate, trigger, references on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

alter function public.update_updated_at() set search_path = public;
alter function public.guard_pipeline_stage_update() set search_path = public;

-- Mensaje en tuteo (era voseo).
create or replace function public.soft_delete_deal(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal deals%rowtype;
begin
  select * into v_deal from deals
    where id = p_deal_id and organization_id = current_org_id() and deleted_at is null;

  if not found then
    raise exception 'Deal no encontrado o ya eliminado';
  end if;

  if not (is_manager() or v_deal.owner_id = auth.uid()) then
    raise exception 'No tienes permiso para eliminar este deal';
  end if;

  update deals set deleted_at = now() where id = p_deal_id;

  insert into audit_log (organization_id, user_id, action, entity_type, entity_id, old_value)
  values (v_deal.organization_id, auth.uid(), 'delete', 'deal', p_deal_id, to_jsonb(v_deal));
end;
$$;
revoke all on function public.soft_delete_deal(uuid) from public, anon;
grant execute on function public.soft_delete_deal(uuid) to authenticated;
