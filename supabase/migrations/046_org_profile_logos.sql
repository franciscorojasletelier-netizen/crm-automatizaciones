-- ============================================================
--  046 — Perfil de la empresa para documentos y correos.
--
--  * organizations.payment_instructions: datos para pagar (banco, cuenta,
--    RUT, correo de comprobantes). Aparecen en los correos de cobranza y
--    en el estado de cuenta.
--  * Bucket público "logos": el logo tiene que verse desde clientes de
--    correo externos (no puede ser una URL firmada que vence). Cada
--    organización escribe solo en su carpeta {organization_id}/.
-- ============================================================

alter table organizations add column if not exists payment_instructions text;
alter table organizations drop constraint if exists organizations_payment_instructions_len;
alter table organizations add constraint organizations_payment_instructions_len
  check (payment_instructions is null or length(payment_instructions) <= 1000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 524288, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists logos_insert_own_org on storage.objects;
create policy logos_insert_own_org on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = current_org_id()::text and is_manager());

drop policy if exists logos_update_own_org on storage.objects;
create policy logos_update_own_org on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = current_org_id()::text and is_manager())
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = current_org_id()::text and is_manager());

drop policy if exists logos_delete_own_org on storage.objects;
create policy logos_delete_own_org on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = current_org_id()::text and is_manager());
