-- ============================================================
--  062 · Plantillas de correo personales
--
--  profiles.email_templates: plantillas propias de cada usuario, además
--  de las de la empresa (organizations.email_templates, 061). Mismo
--  formato {id, label, subject, body}. Cada usuario edita las suyas con la
--  política de autoedición de profiles; el guardián de privilegios (040)
--  no las toca.
-- ============================================================

alter table profiles add column if not exists email_templates jsonb;
alter table profiles drop constraint if exists profiles_email_templates_check;
alter table profiles add constraint profiles_email_templates_check
  check (
    email_templates is null or (
      jsonb_typeof(email_templates) = 'array'
      and jsonb_array_length(email_templates) <= 20
      and length(email_templates::text) <= 30000
    )
  );
