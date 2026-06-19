-- ============================================================
--  ACCESO POR SECCIONES (checklist por usuario)
--  section_access = lista de secciones a las que entra la persona.
--  NULL  -> sin restriccion extra (acceso segun su nivel base).
--  []    -> sin acceso a nada (solo lo minimo).
--  Ejecutar en Supabase -> SQL Editor
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS section_access JSONB;

-- (No requiere grants nuevos: es una columna de la tabla profiles existente.)
