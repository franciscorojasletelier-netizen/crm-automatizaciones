-- ============================================================
--  065 · Teléfono de contacto normalizado (solo dígitos)
--
--  El formulario guarda el teléfono tal como se escribe ("+56 9 5450 7488"),
--  pero WhatsApp entrega el remitente como "56954507488". El webhook buscaba
--  por igualdad exacta, así que un número con espacios o guiones nunca
--  calzaba y el mensaje se descartaba. phone_digits se calcula solo.
-- ============================================================

alter table contacts
  add column if not exists phone_digits text
  generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored;

create index if not exists contacts_org_phone_digits_idx
  on contacts (organization_id, phone_digits)
  where phone_digits is not null;
