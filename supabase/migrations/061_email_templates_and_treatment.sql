-- ============================================================
--  061 · Correos desde el lead: trato del contacto y plantillas
--
--  - contacts.treatment: 'sr' | 'sra' | null. Lo usa el saludo formal
--    ("Estimado"/"Estimada"); sin dato queda "Estimado(a)".
--  - organizations.email_templates: plantillas por situación (primer
--    contacto, seguimiento…) que edita gerencia en Configuración. Null =
--    el CRM usa sus plantillas por defecto. Arreglo de objetos
--    {id, label, subject, body}; acotado para que no crezca sin control.
-- ============================================================

alter table contacts add column if not exists treatment text;
alter table contacts drop constraint if exists contacts_treatment_check;
alter table contacts add constraint contacts_treatment_check
  check (treatment is null or treatment in ('sr', 'sra'));

alter table organizations add column if not exists email_templates jsonb;
alter table organizations drop constraint if exists organizations_email_templates_check;
alter table organizations add constraint organizations_email_templates_check
  check (
    email_templates is null or (
      jsonb_typeof(email_templates) = 'array'
      and jsonb_array_length(email_templates) <= 20
      and length(email_templates::text) <= 30000
    )
  );
