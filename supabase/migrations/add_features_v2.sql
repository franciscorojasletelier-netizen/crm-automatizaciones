-- ═══════════════════════════════════════════════════════════
--  MIGRACIÓN v2 — Notificaciones + Automatizaciones
--  Ejecutar completo en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. TABLA: notifications
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  -- tipos: 'deal_assigned' | 'task_due' | 'task_overdue' | 'stage_changed' | 'automation' | 'mention'
  title       text        NOT NULL,
  body        text,
  entity_type text,       -- 'deal' | 'task' | 'project'
  entity_id   uuid,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve solo sus notificaciones
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Insertar notificaciones para cualquier usuario autenticado (ej: gerente crea notif para ejecutivo)
CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Solo el dueño puede marcar como leída o borrarla
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────
-- 2. TABLA: automation_rules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  trigger_type   text        NOT NULL,
  -- trigger_types: 'stage_change' | 'days_inactive' | 'deal_won' | 'deal_lost' | 'task_overdue'
  trigger_config jsonb       NOT NULL DEFAULT '{}',
  action_type    text        NOT NULL,
  -- action_types: 'create_task' | 'notify_owner' | 'notify_team' | 'change_stage'
  action_config  jsonb       NOT NULL DEFAULT '{}',
  is_active      boolean     NOT NULL DEFAULT true,
  run_count      integer     NOT NULL DEFAULT 0,
  last_run_at    timestamptz,
  created_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Solo super_admin y gerente pueden gestionar reglas
CREATE POLICY "automation_rules_manage" ON automation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'gerente', 'admin')
    )
  );

-- Todos los autenticados pueden leer reglas activas (para ejecutarlas client-side)
CREATE POLICY "automation_rules_read_active" ON automation_rules
  FOR SELECT USING (is_active = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON automation_rules TO authenticated;

-- ─────────────────────────────────────────────
-- 3. TABLA: automation_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     uuid        REFERENCES automation_rules(id) ON DELETE SET NULL,
  rule_name   text,
  entity_type text,
  entity_id   uuid,
  status      text        NOT NULL DEFAULT 'success', -- 'success' | 'failed' | 'skipped'
  details     jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_logs_manage" ON automation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'gerente', 'admin')
    )
  );

CREATE POLICY "automation_logs_insert" ON automation_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT ON automation_logs TO authenticated;

-- ─────────────────────────────────────────────
-- 4. VERIFICACIONES: tablas que deben existir
-- ─────────────────────────────────────────────
-- Las siguientes tablas deben existir antes de ejecutar esto:
--   profiles, deals, tasks, projects, companies, contacts
--   pipeline_stage_history, deal_members, team_messages
-- Si alguna falta, revisar migraciones anteriores.

-- ─────────────────────────────────────────────
-- 5. Insertar algunas reglas de ejemplo
-- ─────────────────────────────────────────────
-- (Ejecutar solo si quieres datos de demo)
-- INSERT INTO automation_rules (name, description, trigger_type, trigger_config, action_type, action_config) VALUES
-- (
--   'Tarea de seguimiento al enviar propuesta',
--   'Crea una tarea de seguimiento 3 días después de enviar propuesta',
--   'stage_change',
--   '{"from_stage": "any", "to_stage": "propuesta_enviada"}',
--   'create_task',
--   '{"title": "Seguimiento propuesta enviada", "days_after": 3, "assign_to": "owner"}'
-- ),
-- (
--   'Alerta por deal inactivo',
--   'Notifica al ejecutivo si el deal lleva 7 días sin actividad',
--   'days_inactive',
--   '{"days": 7, "stages": ["contactado", "calificado", "reunion_agendada"]}',
--   'notify_owner',
--   '{"message": "Este deal lleva más de 7 días sin actividad"}'
-- );

-- ─────────────────────────────────────────────
-- ✅ FIN MIGRACIÓN
-- ─────────────────────────────────────────────
