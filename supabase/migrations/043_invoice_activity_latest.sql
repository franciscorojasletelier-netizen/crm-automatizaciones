-- ============================================================
--  043 — Última gestión y compromiso vigente según fecha, no orden de
--  inserción. Con cargas masivas o importaciones (gestiones con
--  created_at en el pasado) la última fila insertada pisaba a la más
--  reciente: la cola de cobro mostraba la gestión equivocada.
-- ============================================================
create or replace function invoice_activities_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices
     set next_promise_date = case
           when new.kind = 'compromiso'
            and new.created_at >= coalesce(last_activity_at, '-infinity'::timestamptz)
           then new.promise_date
           else next_promise_date end,
         last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at)
   where id = new.invoice_id;
  return null;
end;
$$;

revoke all on function invoice_activities_after_insert() from public, anon, authenticated;

-- Recalcular con los datos existentes.
update invoices i
   set last_activity_at = (select max(created_at) from invoice_activities a where a.invoice_id = i.id)
 where exists (select 1 from invoice_activities a where a.invoice_id = i.id);

update invoices i
   set next_promise_date = (select promise_date from invoice_activities a
                             where a.invoice_id = i.id and a.kind = 'compromiso'
                             order by a.created_at desc limit 1)
 where exists (select 1 from invoice_activities a where a.invoice_id = i.id and a.kind = 'compromiso');
