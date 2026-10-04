-- 053 — Programa el cron del aviso 5 minutos antes (052).
-- Aplicar DESPUÉS de desplegar /api/cron/task-soon en producción: cron_call
-- llama a la URL de producción y antes del despliegue daría 404 cada minuto.
-- Cada minuto: el aviso sale entre 5 y 4 minutos antes de la hora.
select cron.unschedule('cron-task-soon') where exists (select 1 from cron.job where jobname = 'cron-task-soon');
select cron.schedule('cron-task-soon', '* * * * *', $$select cron_call('/api/cron/task-soon')$$);
