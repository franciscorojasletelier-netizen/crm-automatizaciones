-- ============================================================
--  FIX: GRANT faltantes detectados en auditoría general
--  RLS sin GRANT explícito = "permission denied" para usuarios
--  autenticados aunque las políticas sean correctas.
--  Idempotente: se puede ejecutar varias veces sin problema.
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

grant select, insert, update, delete on profiles             to authenticated;
grant select, insert, update, delete on companies             to authenticated;
grant select, insert, update, delete on contacts              to authenticated;
grant select, insert, update, delete on deals                 to authenticated;
grant select, insert, update, delete on pipeline_stage_history to authenticated;
grant select, insert, update, delete on interactions          to authenticated;
grant select, insert, update, delete on tasks                 to authenticated;
grant select, insert            on user_activity_log     to authenticated;
grant select, insert            on user_sessions          to authenticated;
grant select, insert            on audit_log              to authenticated;

-- task_history: nunca tuvo GRANT (bug)
grant select, insert on task_history to authenticated;

-- team_messages: nunca tuvo GRANT (bug)
grant select, insert, delete on team_messages to authenticated;

-- deal_members / project_members: ya están en security_hardening.sql,
-- se repiten aquí por si esa migración no llegó a ejecutarse.
grant select, insert, delete on deal_members    to authenticated;
grant select, insert, delete on project_members to authenticated;
