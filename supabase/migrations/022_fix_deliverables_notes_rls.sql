-- ============================================================
--  FASE 2.4 — Hallazgo del diagnóstico de RLS/GRANTs en vivo:
--  `deliverables` y `notes` existen en la base de producción pero
--  NO están en ninguna migración versionada (se crearon a mano en
--  algún momento) y tienen RLS desactivado, sin GRANT ni policies.
--
--  Hoy están de facto inaccesibles (sin GRANT, PostgREST no deja
--  pasar nada) — pero es una mina: si alguien corrige el "0 filas"
--  agregando el GRANT que falta (el error que ya pasó 3 veces en
--  este proyecto) sin fijarse que RLS está apagado, esas tablas
--  quedan expuestas SIN NINGÚN filtro por organización a cualquier
--  usuario autenticado.
--
--  No están en uso en el código de la app (`grep` sin resultados),
--  así que no hace falta escribir policies con la semántica de
--  negocio correcta ahora mismo — alcanza con activar RLS. Sin
--  policies, RLS activado significa denegado por defecto para
--  todos salvo el dueño de la tabla / service_role, que es
--  exactamente el estado seguro que ya tenían de hecho.
-- ============================================================

begin;

alter table if exists deliverables enable row level security;
alter table if exists notes        enable row level security;

commit;
