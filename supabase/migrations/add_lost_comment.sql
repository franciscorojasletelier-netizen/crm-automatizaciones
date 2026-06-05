-- ══════════════════════════════════════════════════
--  Agregar columna lost_comment a deals
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════

ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_comment text;

-- También asegurarse que lost_reason existe
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_reason text;
