-- ══════════════════════════════════════════════════════════════
--  FIX: Permitir que service_role lea tasks y profiles
--  sin restricción de RLS (necesario para el cron de emails)
-- ══════════════════════════════════════════════════════════════

-- tasks: service_role puede leer todas las tareas
CREATE POLICY "service_role_select_tasks"
  ON tasks FOR SELECT
  TO service_role
  USING (true);

-- profiles: service_role puede leer todos los perfiles
CREATE POLICY "service_role_select_profiles"
  ON profiles FOR SELECT
  TO service_role
  USING (true);
