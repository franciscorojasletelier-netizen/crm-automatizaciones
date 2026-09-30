-- ============================================================
--  041 — Fecha real de cierre de un deal + autor correcto del historial.
--
--  1. "Ganados este mes" (dashboard, reportes) filtraba por updated_at:
--     editar cualquier campo de un deal ganado hace un año lo volvía a
--     contar como ganado este mes. Ahora deals.closed_at guarda cuándo
--     se cerró (won/lost) y la base lo mantiene sola: se fija al cerrar,
--     se limpia al reabrir.
--  2. log_deal_stage_change registraba changed_by = owner del deal, no
--     quien hizo el cambio. Ahora usa auth.uid() (con el owner como
--     respaldo para cambios hechos por el servidor), y fija search_path.
-- ============================================================

begin;

alter table deals add column if not exists closed_at timestamptz;
create index if not exists idx_deals_org_status_closed on deals (organization_id, status, closed_at);

-- Backfill: el último paso del historial hacia una etapa cerrada de su
-- organización; si no hay historial, updated_at como mejor aproximación.
update deals d
   set closed_at = coalesce(
     (select max(h.changed_at)
        from pipeline_stage_history h
        join pipeline_stages s on s.organization_id = d.organization_id and s.key = h.to_stage
       where h.deal_id = d.id and (s.is_won or s.is_lost)),
     d.updated_at)
 where d.status in ('won', 'lost') and d.closed_at is null;

create or replace function set_deal_closed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('won', 'lost') then
    if tg_op = 'INSERT' or old.status is distinct from new.status or new.closed_at is null then
      new.closed_at := coalesce(case when tg_op = 'UPDATE' and old.status = new.status then old.closed_at end, now());
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function set_deal_closed_at() from public, anon, authenticated;

drop trigger if exists trg_set_deal_closed_at on deals;
create trigger trg_set_deal_closed_at before insert or update of status on deals
  for each row execute function set_deal_closed_at();

create or replace function log_deal_stage_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.stage is distinct from new.stage then
    insert into pipeline_stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, coalesce(auth.uid(), new.owner_id));
  end if;
  return new;
end;
$$;

revoke all on function log_deal_stage_change() from public, anon, authenticated;

commit;
