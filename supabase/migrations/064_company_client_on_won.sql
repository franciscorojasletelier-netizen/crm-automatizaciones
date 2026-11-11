-- ============================================================
--  064 · La empresa pasa a "Cliente" al ganar un negocio
--
--  companies.is_existing_client solo se marcaba a mano, así que una empresa
--  con un negocio ganado (p. ej. Minera Cordillera Sur) seguía como
--  "Prospecto". El trigger cubre todos los caminos (ficha, pipeline, API).
--  Nunca desmarca: perder otro negocio no le quita la condición de cliente.
-- ============================================================

create or replace function mark_company_client_on_won()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'won' and new.company_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'won') then
    update companies set is_existing_client = true
     where id = new.company_id and is_existing_client is distinct from true;
  end if;
  return new;
end;
$$;

revoke all on function mark_company_client_on_won() from public, anon, authenticated;

drop trigger if exists trg_mark_company_client_on_won on deals;
create trigger trg_mark_company_client_on_won
  after insert or update of status on deals
  for each row execute function mark_company_client_on_won();

-- Empresas que ya tienen un negocio ganado.
update companies c set is_existing_client = true
 where c.is_existing_client is distinct from true
   and exists (select 1 from deals d where d.company_id = c.id and d.status = 'won' and d.deleted_at is null);
