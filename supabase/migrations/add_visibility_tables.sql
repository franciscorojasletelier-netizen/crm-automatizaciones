-- ============================================================
--  VISIBILIDAD POR USUARIO — deal_members y project_members
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── deal_members ─────────────────────────────────────────────
-- Controla qué usuarios pueden ver / editar un deal además del owner
CREATE TABLE IF NOT EXISTS deal_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES deals(id)    ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by   UUID             REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_deal_members_deal_id ON deal_members(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_members_user_id ON deal_members(user_id);

-- RLS
ALTER TABLE deal_members ENABLE ROW LEVEL SECURITY;

-- Lectura: el usuario puede ver sus propias membresías
CREATE POLICY "deal_members_select" ON deal_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

-- Escritura: solo gerentes y super_admin pueden gestionar membresías
CREATE POLICY "deal_members_insert" ON deal_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

CREATE POLICY "deal_members_delete" ON deal_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

-- ── project_members ───────────────────────────────────────────
-- Controla qué usuarios del equipo de producción ven un proyecto
CREATE TABLE IF NOT EXISTS project_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  added_by   UUID             REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members(user_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select" ON project_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

-- ── Migrar deals existentes: asignar el owner como member ─────
-- Esto asegura que los deals ya existentes con owner_id sean visibles
INSERT INTO deal_members (deal_id, user_id)
SELECT id, owner_id FROM deals
WHERE owner_id IS NOT NULL
ON CONFLICT (deal_id, user_id) DO NOTHING;

-- Migrar proyectos existentes
INSERT INTO project_members (project_id, user_id)
SELECT id, owner_id FROM projects
WHERE owner_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;
