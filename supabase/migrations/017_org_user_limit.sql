-- ============================================================
--  Límite de usuarios por organización.
--
--  NULL = sin límite (compatibilidad con las organizaciones ya
--  creadas). Se fija desde el panel de plataforma; el propio cliente
--  no puede tocarlo, solo el dueño de la plataforma. Es un factor de
--  venta: cada plan/contrato puede tener un tope de usuarios distinto.
-- ============================================================

begin;

alter table organizations add column if not exists max_users integer;
alter table organizations add constraint max_users_positive check (max_users is null or max_users > 0);

commit;
