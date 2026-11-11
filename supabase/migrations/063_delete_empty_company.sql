-- ============================================================
--  063 · Eliminar empresas vacías
--
--  Al borrar un lead (soft delete) su empresa quedaba en la lista para
--  siempre: companies no tiene política DELETE. Esta función permite a
--  gerencia borrar una empresa de SU organización solo si no tiene
--  negocios activos, documentos de cobranza ni proyectos. Borra también
--  sus contactos que no son contacto principal de un negocio activo, y
--  deja registro en audit_log.
-- ============================================================

create or replace function delete_company_if_empty(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies%rowtype;
begin
  select * into v_company from companies
    where id = p_company_id and organization_id = current_org_id();
  if not found then
    raise exception 'Empresa no encontrada';
  end if;

  if not is_manager() then
    raise exception 'Solo gerencia puede eliminar empresas';
  end if;

  if exists (select 1 from deals where company_id = p_company_id and deleted_at is null) then
    raise exception 'La empresa tiene negocios; elimínalos o reasígnalos primero';
  end if;
  if exists (select 1 from invoices where company_id = p_company_id) then
    raise exception 'La empresa tiene documentos de cobranza y no se puede eliminar';
  end if;
  if exists (select 1 from projects where company_id = p_company_id) then
    raise exception 'La empresa tiene proyectos y no se puede eliminar';
  end if;

  delete from contacts c
   where c.company_id = p_company_id
     and not exists (
       select 1 from deals d where d.primary_contact_id = c.id and d.deleted_at is null
     );

  delete from companies where id = p_company_id;

  insert into audit_log (organization_id, user_id, action, entity_type, entity_id, old_value)
  values (v_company.organization_id, auth.uid(), 'delete', 'company', p_company_id, to_jsonb(v_company));
end;
$$;

revoke all on function delete_company_if_empty(uuid) from public, anon;
grant execute on function delete_company_if_empty(uuid) to authenticated, service_role;
