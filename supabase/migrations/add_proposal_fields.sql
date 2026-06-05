-- ============================================================
--  PROPUESTA EN DEALS
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Agregar campos de propuesta a deals
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS proposal_url       TEXT,
  ADD COLUMN IF NOT EXISTS proposal_filename  TEXT,
  ADD COLUMN IF NOT EXISTS proposal_size      INTEGER,  -- bytes
  ADD COLUMN IF NOT EXISTS proposal_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_uploaded_by UUID REFERENCES profiles(id);

-- ── Bucket de almacenamiento ──────────────────────────────────
-- Ejecutar también en Supabase → Storage → New Bucket:
--   Nombre: propuestas
--   Public: FALSE (acceso privado con signed URLs)
--
-- O ejecutar esto si tienes acceso a la API de admin:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('propuestas', 'propuestas', false);

-- ── Política de Storage (ejecutar en SQL Editor) ──────────────
-- Permitir lectura a usuarios autenticados de sus propias propuestas
-- (Ajustar según tus necesidades de RLS en storage)
