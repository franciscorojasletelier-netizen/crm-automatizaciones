-- ============================================================
--  AREAS / DEPARTAMENTOS + CARGOS LIBRES
--  Separa el "cargo" y el "area" del rol de permisos del sistema.
--  Ejecutar en Supabase -> SQL Editor
-- ============================================================

-- ── 1. Areas / departamentos (gestionables) ─────────────────
CREATE TABLE IF NOT EXISTS areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver las areas
DROP POLICY IF EXISTS "areas_select" ON areas;
CREATE POLICY "areas_select" ON areas
  FOR SELECT TO authenticated USING (true);

-- Solo jefaturas (super_admin / gerente) crean, editan y borran areas
DROP POLICY IF EXISTS "areas_manage" ON areas;
CREATE POLICY "areas_manage" ON areas
  FOR ALL TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

-- ── 2. Cargo libre y area en cada persona ───────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_area_id ON profiles(area_id);

-- ── 3. Areas iniciales de ejemplo (puedes editarlas/borrarlas) ──
INSERT INTO areas (name, color) VALUES
  ('Dirección',     '#7c3aed'),
  ('Ventas',        '#2563eb'),
  ('Marketing',     '#db2777'),
  ('Operaciones',   '#f59e0b'),
  ('Producción',    '#16a34a'),
  ('Finanzas',      '#0891b2'),
  ('Administración', '#64748b'),
  ('Soporte',       '#9333ea')
ON CONFLICT (name) DO NOTHING;
