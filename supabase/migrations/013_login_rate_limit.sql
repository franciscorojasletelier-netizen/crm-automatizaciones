-- ============================================================
--  Rate limiting propio para el login (defensa en profundidad,
--  además del rate limit nativo de Supabase Auth).
--  Registra cada intento de login (éxito/fallo) por email + IP.
--  Solo accesible via service_role (el endpoint /api/auth/login
--  es el único que la lee/escribe) — RLS activado sin policies
--  para authenticated/anon, así ni siquiera un cliente comprometido
--  puede leer ni falsear el historial de intentos.
-- ============================================================

begin;

create table if not exists login_attempts (
  id         bigint generated always as identity primary key,
  email      text not null,
  ip         text not null,
  success    boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_time on login_attempts(email, created_at desc);
create index if not exists idx_login_attempts_ip_time    on login_attempts(ip, created_at desc);

alter table login_attempts enable row level security;
-- Sin policies para authenticated/anon = nadie puede leer ni escribir
-- salvo service_role (que evade RLS por diseño de Supabase).

grant select, insert on login_attempts to service_role;

commit;
