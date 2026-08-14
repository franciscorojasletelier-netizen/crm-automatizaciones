-- ============================================================
--  FASE 2.1 — Eliminación transaccional de deals (soft delete)
--             + primer uso real de audit_log.
--
--  Antes: delete-deal-button.tsx hacía 6 DELETE encadenados desde
--  el cliente, sin transacción — si el tercero fallaba (ej. una
--  policy RLS lo bloqueaba), los dos primeros ya habían corrido y
--  quedaba el deal a medio borrar. Peor: borraba también `contacts`
--  y `companies`, que NO son propiedad exclusiva de ese deal (una
--  empresa puede tener varios deals) — eliminar un deal podía
--  destruir silenciosamente una empresa/contacto usado por otros
--  deals, dejándolos con company_id/contact_id en null.
--
--  Ahora: nunca se borra la fila. Se marca `deleted_at` en una
--  sola sentencia atómica (una UPDATE es siempre transaccional en
--  Postgres) dentro de una función. Los hijos (tasks, interactions,
--  pipeline_stage_history, deal_ai_insights) quedan intactos —ya no
--  hay nada que borrar en cascada, y el historial sobrevive, que es
--  lo que un audit log real necesita poder mostrar después.
--
--  audit_log existía desde la migración 001 pero nunca se
--  insertaba nada: es la primera escritura real.
-- ============================================================

begin;

alter table deals add column if not exists deleted_at timestamptz;

-- Los deals borrados dejan de existir para cualquier lectura vía
-- RLS — no hace falta tocar los ~25 sitios del código que hacen
-- `.from('deals').select(...)`, la base los filtra sola.
drop policy if exists "deals_select" on deals;
create policy "deals_select" on deals
  for select using (
    deleted_at is null
    and organization_id = current_org_id()
    and (
      is_manager()
      or owner_id = auth.uid()
      or exists (select 1 from deal_members dm where dm.deal_id = deals.id and dm.user_id = auth.uid())
    )
  );

-- El hard delete deja de ser una vía posible para `authenticated`:
-- el único camino para "borrar" un deal es soft_delete_deal().
drop policy if exists "deals_delete" on deals;

create or replace function soft_delete_deal(p_deal_id uuid)
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
    raise exception 'No tenés permiso para eliminar este deal';
  end if;

  update deals set deleted_at = now() where id = p_deal_id;

  -- organization_id se pasa explícito: el trigger genérico
  -- set_org_from_user() intenta leer NEW.deal_id/NEW.company_id
  -- cuando organization_id viene null, y audit_log no tiene esas
  -- columnas — pasarlo ya resuelto evita ese camino roto.
  insert into audit_log (organization_id, user_id, action, entity_type, entity_id, old_value)
  values (v_deal.organization_id, auth.uid(), 'delete', 'deal', p_deal_id, to_jsonb(v_deal));
end;
$$;

grant execute on function soft_delete_deal(uuid) to authenticated;

commit;
