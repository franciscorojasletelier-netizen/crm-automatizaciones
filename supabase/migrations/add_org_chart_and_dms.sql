-- ============================================================
--  ORGANIGRAMA + CHAT DIRECTO 1-A-1
--  Ejecutar en Supabase -> SQL Editor
-- ============================================================

-- ── 1. Jerarquía: jefe directo de cada persona ──────────────
-- manager_id apunta a otro profile (su jefe). NULL = raíz (sin jefe).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);

-- La edición de manager_id de OTROS perfiles queda cubierta por la policy
-- existente "profiles_update_by_manager" (is_manager() and id <> auth.uid()).

-- ── 2. Mensajes directos (DM) entre dos usuarios ────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) > 0),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_no_self CHECK (sender_id <> recipient_id)
);

-- Índices para listar una conversación y contar no leídos
CREATE INDEX IF NOT EXISTS idx_dm_pair       ON direct_messages(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dm_recipient  ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_unread     ON direct_messages(recipient_id) WHERE read_at IS NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- ── 3. RLS: solo emisor y receptor acceden a sus mensajes ───
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Privilegios de tabla para el rol authenticated (ademas de las policies RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON direct_messages TO authenticated;

-- Leer: si soy parte de la conversación (emisor o receptor)
CREATE POLICY "dm_select_participants" ON direct_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Enviar: solo con mi propio user_id como emisor
CREATE POLICY "dm_insert_sender" ON direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Actualizar (marcar leído): solo el receptor sobre sus mensajes recibidos
CREATE POLICY "dm_update_recipient" ON direct_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Borrar: solo el emisor sus propios mensajes
CREATE POLICY "dm_delete_sender" ON direct_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
