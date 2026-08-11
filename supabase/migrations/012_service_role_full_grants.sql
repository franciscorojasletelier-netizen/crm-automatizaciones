-- ============================================================
--  FIX: service_role sin privilegios en varias tablas (ej. profiles)
--  Se detectó que service_role solo tenía REFERENCES/TRIGGER/TRUNCATE
--  en `profiles` — sin SELECT/INSERT/UPDATE/DELETE. Los endpoints
--  admin (create-user, create-organization) usan el cliente
--  service_role y fallaban con "permission denied for table profiles".
--  Es probable que el mismo hueco exista en otras tablas.
--
--  service_role es la clave privilegiada de servidor (nunca se expone
--  al navegador) — es seguro y es el patrón estándar de Supabase
--  darle acceso total a todas las tablas.
-- ============================================================

grant all privileges on all tables in schema public to service_role;

-- Para que las tablas que se creen a futuro también lo tengan
-- automáticamente, sin depender de acordarse de este GRANT cada vez.
alter default privileges in schema public grant all on tables to service_role;
