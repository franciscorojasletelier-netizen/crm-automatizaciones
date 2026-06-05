-- ══════════════════════════════════════════════════════════
--  Flujo: Devolver proyecto a comercial por especificaciones
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- Columnas para el flujo de especificaciones pendientes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spec_notes        text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spec_requested_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spec_requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spec_resolved_at  timestamptz;

-- El status 'pendiente_especificaciones' se maneja a nivel de aplicación
-- No requiere cambios de tipo (status ya es text libre)
