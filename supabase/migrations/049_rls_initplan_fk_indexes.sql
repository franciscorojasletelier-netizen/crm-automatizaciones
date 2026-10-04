-- ============================================================
--  049 — Rendimiento de RLS e índices (advisors de Supabase).
--
--  * auth_rls_initplan: las políticas que llaman auth.uid() directo lo
--    reevalúan por cada fila. Envuelto en (select auth.uid()) se calcula
--    una vez por consulta. Mismo resultado lógico; se reescriben todas
--    las políticas de public que lo usan.
--  * unindexed_foreign_keys: índice para cada clave foránea sin uno que
--    la cubra (acelera joins, filtros por relación y borrados en cascada).
-- ============================================================
do $$
declare
  p record;
  v_using text;
  v_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
  loop
    v_using := regexp_replace(p.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    v_check := regexp_replace(p.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if v_using is not null then stmt := stmt || format(' using (%s)', v_using); end if;
    if v_check is not null then stmt := stmt || format(' with check (%s)', v_check); end if;
    execute stmt;
  end loop;
end $$;

do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname,
           array_agg(a.attname order by k.ord) as cols
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey
      )
    group by c.conrelid, c.conname
  loop
    execute format('create index if not exists %I on %s (%s)',
      left('idx_fk_' || fk.conname, 63), fk.tbl,
      (select string_agg(format('%I', col), ', ') from unnest(fk.cols) col));
  end loop;
end $$;

-- La política de autoedición de profiles leía la propia tabla en una
-- subconsulta; con auth.uid() como initplan Postgres ya no la cortaba y
-- daba "infinite recursion". Se lee el estado con una función SECURITY
-- DEFINER (sin RLS).
create or replace function public.current_user_is_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_active from profiles where id = auth.uid()
$$;
revoke all on function public.current_user_is_active() from public, anon;
grant execute on function public.current_user_is_active() to authenticated, service_role;

alter policy profiles_update_self_norole on public.profiles
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (role)::text = current_user_role()
    and is_active = current_user_is_active()
    and organization_id = current_org_id()
  );
