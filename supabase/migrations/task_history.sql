-- ============================================================
-- Tabla: task_history
-- Registra cada cambio realizado a una tarea con comentario
-- obligatorio y el usuario que lo realizó.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_history (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  field_changed text        NOT NULL,            -- 'due_date', 'title', 'status', etc.
  old_value     text,
  new_value     text,
  comment       text        NOT NULL,            -- obligatorio
  created_at    timestamptz DEFAULT now() NOT NULL
);

-- Índice para búsquedas por tarea
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at DESC);

-- ============================================================
-- RLS: cada usuario ve el historial de tareas que puede ver.
-- Admin/gerente ven todo.
-- ============================================================

ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los miembros activos (la visibilidad se maneja en la app)
CREATE POLICY "task_history_select" ON task_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

-- Inserción: solo el propio usuario autenticado
CREATE POLICY "task_history_insert" ON task_history
  FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- ============================================================
-- Función SECURITY DEFINER para que el trigger rellene
-- changed_by automáticamente con auth.uid()
-- ============================================================

CREATE OR REPLACE FUNCTION set_task_history_changed_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.changed_by IS NULL THEN
    NEW.changed_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_task_history_changed_by
  BEFORE INSERT ON task_history
  FOR EACH ROW EXECUTE FUNCTION set_task_history_changed_by();
