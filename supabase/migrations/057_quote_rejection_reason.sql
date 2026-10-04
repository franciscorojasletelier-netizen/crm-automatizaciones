-- 057 — Motivo (opcional) con que el cliente rechaza una cotización desde el link.
alter table quotes add column if not exists rejection_reason text;
alter table quotes drop constraint if exists quotes_rejection_reason_len;
alter table quotes add constraint quotes_rejection_reason_len check (rejection_reason is null or length(rejection_reason) <= 1000);
