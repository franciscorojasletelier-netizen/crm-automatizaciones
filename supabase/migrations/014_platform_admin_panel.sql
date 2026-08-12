-- ============================================================
--  Panel de administración de plataforma: permite al dueño de la
--  plataforma (platform_owners) listar organizaciones clientes y
--  suspenderlas/reactivarlas sin borrar datos.
-- ============================================================

begin;

alter table organizations add column if not exists is_active boolean not null default true;

-- El dueño de la plataforma puede actualizar cualquier organización
-- (solo se usa para is_active desde el endpoint, pero se deja general
-- por si el panel crece — sigue protegido por is_platform_owner()).
drop policy if exists "organizations_update_by_platform_owner" on organizations;
create policy "organizations_update_by_platform_owner" on organizations
  for update using (is_platform_owner()) with check (is_platform_owner());

commit;
