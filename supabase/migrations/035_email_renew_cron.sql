-- ============================================================
--  FASE 9.2 — cron de renovación de suscripciones de email.
--
--  Reutiliza cron_call() y los secretos ya guardados en Vault por la
--  migración 032 — nada nuevo que configurar acá.
-- ============================================================

begin;

select cron.schedule('cron-email-renew', '0 */6 * * *', $$select cron_call('/api/cron/email-renew')$$);

commit;
