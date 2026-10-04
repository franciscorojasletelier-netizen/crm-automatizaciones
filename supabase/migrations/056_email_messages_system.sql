-- 056 — Correos enviados desde el correo del sistema (Resend) también
-- quedan en el historial del deal: no tienen cuenta conectada.
alter table email_messages alter column email_account_id drop not null;
