-- ============================================================
--  039 — Rol Finanzas como dueño de la cobranza.
--
--  La cobranza la opera administración/finanzas, no gerencia comercial.
--  El valor 'finanzas' ya existía en el enum user_role (legacy de la
--  001) y la app lo trataba como 'soporte'; ningún perfil lo usa, así
--  que se le da significado propio sin afectar a nadie.
--
--  Finanzas:
--  * gestiona TODA la cobranza de su organización (igual que gerencia);
--  * lee empresas y contactos de su organización (a quién se cobra y a
--    quién llamar), aunque no sea dueño de ningún deal;
--  * NO ve el pipeline comercial (deals sigue con su RLS de siempre).
-- ============================================================

begin;

create or replace function is_collections_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text in ('super_admin', 'admin', 'gerente', 'finanzas') from profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function is_collections_manager() from public, anon;
grant execute on function is_collections_manager() to authenticated, service_role;

-- ── Cobranza: gerencia O finanzas ─────────────────────────────
drop policy if exists "invoices_select" on invoices;
create policy "invoices_select" on invoices for select using (
  organization_id = current_org_id() and (
    is_collections_manager()
    or responsible_id = auth.uid()
    or (deal_id is not null and can_see_deal(deal_id))
  )
);

drop policy if exists "invoices_insert" on invoices;
create policy "invoices_insert" on invoices for insert
  with check (organization_id = current_org_id() and is_collections_manager());

drop policy if exists "invoices_update" on invoices;
create policy "invoices_update" on invoices for update
  using (organization_id = current_org_id() and is_collections_manager())
  with check (organization_id = current_org_id() and is_collections_manager());

drop policy if exists "invoice_payments_insert" on invoice_payments;
create policy "invoice_payments_insert" on invoice_payments for insert
  with check (is_collections_manager() and exists (select 1 from invoices i where i.id = invoice_id));

drop policy if exists "invoice_payments_delete" on invoice_payments;
create policy "invoice_payments_delete" on invoice_payments for delete
  using (organization_id = current_org_id() and is_collections_manager());

-- ── Lectura de clientes para finanzas ─────────────────────────
-- Políticas permisivas adicionales: se suman (OR) a las existentes.
drop policy if exists "companies_select_finanzas" on companies;
create policy "companies_select_finanzas" on companies for select
  using (organization_id = current_org_id() and current_user_role() = 'finanzas');

drop policy if exists "contacts_select_finanzas" on contacts;
create policy "contacts_select_finanzas" on contacts for select
  using (organization_id = current_org_id() and current_user_role() = 'finanzas');

commit;
