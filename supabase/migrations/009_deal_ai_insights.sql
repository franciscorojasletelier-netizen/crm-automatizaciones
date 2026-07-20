-- ============================================================
--  Análisis IA persistente por deal
--  El análisis queda guardado y viaja con el deal entre etapas
--  y personas. Se conserva historial (un registro por análisis).
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS deal_ai_insights (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  insights   JSONB NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_ai_insights_deal
  ON deal_ai_insights(deal_id, created_at DESC);

ALTER TABLE deal_ai_insights ENABLE ROW LEVEL SECURITY;

-- Lectura: quien puede ver el deal puede ver su análisis
CREATE POLICY "deal_ai_insights_select" ON deal_ai_insights
  FOR SELECT USING (can_see_deal(deal_id));

-- Inserción: usuarios autenticados con acceso al deal, firmando como ellos mismos
CREATE POLICY "deal_ai_insights_insert" ON deal_ai_insights
  FOR INSERT WITH CHECK (created_by = auth.uid() AND can_see_deal(deal_id));

-- GRANT explícito (patrón requerido en este proyecto: RLS + GRANT)
GRANT SELECT, INSERT ON deal_ai_insights TO authenticated;
GRANT ALL ON deal_ai_insights TO service_role;
