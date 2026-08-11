-- ============================================================
--  FIX: GRANT faltante en organizations/platform_owners
--  (010_multi_tenant_foundation.sql las creó con RLS pero sin GRANT
--  explícito — mismo patrón de bug ya visto en 006_grants_audit_fix.sql.
--  Ya se corrió manualmente al detectar el problema; este archivo
--  solo deja el fix documentado en el repo.)
-- ============================================================

grant select on organizations   to authenticated;
grant select on platform_owners to authenticated;
