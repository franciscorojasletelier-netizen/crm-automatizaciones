-- ============================================================
--  CHAT INTERNO DEL EQUIPO — team_messages
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS team_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL CHECK (char_length(content) > 0),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id    UUID REFERENCES deals(id) ON DELETE CASCADE, -- NULL = chat global
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_deal_id    ON team_messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_user_id    ON team_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created_at ON team_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_global     ON team_messages(created_at DESC) WHERE deal_id IS NULL;

-- Habilitar Realtime para actualizaciones en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;

-- RLS
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer mensajes
CREATE POLICY "team_messages_select" ON team_messages
  FOR SELECT TO authenticated USING (true);

-- Solo el autor puede insertar con su propio user_id
CREATE POLICY "team_messages_insert" ON team_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Solo el autor puede eliminar su mensaje
CREATE POLICY "team_messages_delete" ON team_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
