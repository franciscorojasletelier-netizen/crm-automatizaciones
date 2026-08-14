-- ============================================================
--  FASE 4.1 — Índice faltante para `deleted_at`.
--
--  La migración 020 agregó `deals.deleted_at` y la policy
--  `deals_select` ahora filtra `deleted_at is null` en CADA lectura
--  de deals (prácticamente cada página del CRM), pero ningún índice
--  existente lo incluye — los de 010_multi_tenant_foundation.sql son
--  (organization_id), (organization_id, stage), (organization_id,
--  owner_id), sin `deleted_at`. Con miles de deals acumulados
--  (activos + soft-eliminados), ese filtro se paga sin índice en
--  cada lectura.
--
--  Índices parciales (`where deleted_at is null`) en vez de agregar
--  la columna a los compuestos existentes: más chicos, más rápidos,
--  y cubren exactamente el patrón de lectura real (la app casi nunca
--  necesita ver deals eliminados).
-- ============================================================

begin;

create index if not exists idx_deals_org_active
  on deals(organization_id) where deleted_at is null;

create index if not exists idx_deals_org_stage_active
  on deals(organization_id, stage) where deleted_at is null;

create index if not exists idx_deals_org_owner_active
  on deals(organization_id, owner_id) where deleted_at is null;

commit;
