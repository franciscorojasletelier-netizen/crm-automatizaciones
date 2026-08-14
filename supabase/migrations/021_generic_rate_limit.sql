-- ============================================================
--  FASE 2.2 — Rate limiting genérico.
--
--  Mismo patrón que login_attempts (013): tabla de solo
--  service_role, sin policies para authenticated/anon. Sirve para
--  cualquier endpoint sensible además del login — el primero en
--  usarla es /api/admin/reset-user-password, que hoy no tiene
--  ningún freno: un gerente (o una sesión comprometida) podía
--  disparar generateLink()/emails de reset sin límite.
-- ============================================================

begin;

create table if not exists rate_limit_hits (
  id         bigint generated always as identity primary key,
  bucket     text not null,   -- nombre del endpoint/acción, ej. 'admin_reset_password'
  rl_key     text not null,   -- qué se está limitando: user id, ip, email...
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_lookup on rate_limit_hits(bucket, rl_key, created_at desc);

alter table rate_limit_hits enable row level security;
-- Sin policies para authenticated/anon a propósito, igual que login_attempts.

grant select, insert on rate_limit_hits to service_role;

commit;
