-- ============================================================
--  FIX: falta GRANT UPDATE en organizations para authenticated.
--
--  Mismo patrón que ya se vio varias veces en este proyecto: la
--  migración 014 agregó la policy "organizations_update_by_platform_owner"
--  (RLS), pero organizations solo tenía GRANT SELECT para authenticated
--  desde la migración 010 — nunca se agregó UPDATE. Resultado:
--  "permission denied for table organizations" al intentar guardar
--  max_users (o cualquier otro campo) desde el panel de plataforma,
--  aunque la policy de RLS sea correcta.
-- ============================================================

grant update on organizations to authenticated;
