-- ============================================================
--  047 — El dueño de la plataforma puede subir el logo de cualquier
--  organización (al crearla o desde su ficha). Los administradores de
--  cada organización siguen limitados a su propia carpeta.
-- ============================================================
drop policy if exists logos_insert_own_org on storage.objects;
create policy logos_insert_own_org on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (
    is_platform_owner()
    or ((storage.foldername(name))[1] = current_org_id()::text and is_manager())
  ));

drop policy if exists logos_update_own_org on storage.objects;
create policy logos_update_own_org on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (
    is_platform_owner()
    or ((storage.foldername(name))[1] = current_org_id()::text and is_manager())
  ))
  with check (bucket_id = 'logos' and (
    is_platform_owner()
    or ((storage.foldername(name))[1] = current_org_id()::text and is_manager())
  ));

drop policy if exists logos_delete_own_org on storage.objects;
create policy logos_delete_own_org on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (
    is_platform_owner()
    or ((storage.foldername(name))[1] = current_org_id()::text and is_manager())
  ));
