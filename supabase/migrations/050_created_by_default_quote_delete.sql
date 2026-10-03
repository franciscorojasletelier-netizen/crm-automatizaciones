-- 050 — Autor por defecto y borrado de borradores de cotización
--
-- quotes.created_by no tenía default y el panel no lo enviaba: toda
-- cotización quedaba sin autor, y quotes_update (is_manager() OR
-- created_by = auth.uid()) impedía que un comercial tocara las suyas.
-- El default auth.uid() lo resuelve para cualquier inserción con sesión;
-- en las demás tablas con created_by se agrega como resguardo.

alter table quotes               alter column created_by set default auth.uid();
alter table tasks                alter column created_by set default auth.uid();
alter table whatsapp_templates   alter column created_by set default auth.uid();
alter table deal_ai_insights     alter column created_by set default auth.uid();
alter table automation_rules     alter column created_by set default auth.uid();
alter table automation_sequences alter column created_by set default auth.uid();

-- Solo los borradores se pueden eliminar (una cotización enviada ya tiene
-- link público y puede estar aceptada: esas quedan como registro).
drop policy if exists quotes_delete_draft on quotes;
create policy quotes_delete_draft on quotes for delete to authenticated
  using (
    organization_id = current_org_id()
    and status = 'draft'
    and (is_manager() or created_by = (select auth.uid()))
  );

-- authenticated no tenía DELETE sobre quotes: sin el permiso la política
-- anterior nunca aplica. RLS sigue limitando el borrado a borradores.
grant delete on quotes to authenticated;
