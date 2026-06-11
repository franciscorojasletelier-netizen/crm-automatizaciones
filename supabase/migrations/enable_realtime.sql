-- ════════════════════════════════════════════════════════════════
--  HABILITAR REALTIME — Ejecutar en Supabase → SQL Editor
--  Esto activa la publicación de cambios para el chat y notificaciones
-- ════════════════════════════════════════════════════════════════

-- Publicar tablas en la publicación de Realtime
-- (si alguna ya está, no causa error)
-- Agregar solo si no está ya en la publicación
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table team_messages;
  end if;
end $$;

-- REPLICA IDENTITY FULL permite filtros en postgres_changes
alter table notifications  replica identity full;
alter table team_messages  replica identity full;
