-- ════════════════════════════════════════════════════════════════
--  ENDURECIMIENTO DE SEGURIDAD — RLS por rol
--  Corrige CRÍTICO-1, CRÍTICO-2, MEDIO-1 y ALTO-3 del análisis
--  Ejecutar completo en Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 0. FUNCIONES HELPER (SECURITY DEFINER — evitan recursión de RLS)
-- ────────────────────────────────────────────────────────────────

-- Rol del usuario actual (lee profiles saltándose RLS)
create or replace function current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;

-- ¿El usuario actual es gerente o super_admin?
create or replace function is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('super_admin','admin','gerente') from profiles where id = auth.uid()),
    false
  )
$$;

-- ¿El usuario actual puede ver este deal? (dueño, miembro o gerente)
create or replace function can_see_deal(p_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    is_manager()
    or exists (select 1 from deals d where d.id = p_deal_id and d.owner_id = auth.uid())
    or exists (select 1 from deal_members dm where dm.deal_id = p_deal_id and dm.user_id = auth.uid())
$$;

grant execute on function current_user_role() to authenticated;
grant execute on function is_manager()        to authenticated;
grant execute on function can_see_deal(uuid)   to authenticated;


-- ────────────────────────────────────────────────────────────────
-- 1. CRÍTICO-1 — Impedir auto-promoción de rol en profiles
-- ────────────────────────────────────────────────────────────────

-- SELECT: todos los autenticados pueden ver perfiles (para mostrar nombres)
drop policy if exists "Users can view profiles"     on profiles;
drop policy if exists "Users can view own profile"  on profiles;
create policy "profiles_select" on profiles
  for select using (auth.uid() is not null);

-- INSERT: solo el propio perfil (alta inicial)
drop policy if exists "Users can insert own profile" on profiles;
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

-- UPDATE: el usuario edita su perfil PERO no puede cambiar su propio role ni is_active
drop policy if exists "Users can update own profile"        on profiles;
drop policy if exists "Users update own profile (no role)"  on profiles;
create policy "profiles_update_self_norole" on profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role      = current_user_role()                          -- role no cambia
    and is_active = (select is_active from profiles where id = auth.uid())
  );

-- UPDATE: gerentes/super_admin cambian role/estado de OTROS (nunca de sí mismos)
drop policy if exists "Admins manage other roles" on profiles;
create policy "profiles_update_by_manager" on profiles
  for update
  using (is_manager() and id <> auth.uid())
  with check (is_manager() and id <> auth.uid());


-- ────────────────────────────────────────────────────────────────
-- 2. CRÍTICO-2 — Aislar deals/contacts/companies/tasks por rol
-- ────────────────────────────────────────────────────────────────

-- ---- DEALS ----
drop policy if exists "Authenticated users can view deals"   on deals;
drop policy if exists "Authenticated users can insert deals" on deals;
drop policy if exists "Authenticated users can update deals" on deals;

create policy "deals_select" on deals
  for select using (
    is_manager()
    or owner_id = auth.uid()
    or exists (select 1 from deal_members dm where dm.deal_id = deals.id and dm.user_id = auth.uid())
  );

-- Crear deal: cualquier rol comercial; queda como dueño quien lo crea o un gerente
create policy "deals_insert" on deals
  for insert with check (
    auth.uid() is not null
    and (owner_id = auth.uid() or is_manager())
  );

create policy "deals_update" on deals
  for update using (
    is_manager()
    or owner_id = auth.uid()
    or exists (select 1 from deal_members dm where dm.deal_id = deals.id and dm.user_id = auth.uid())
  );

-- Borrar deal: solo super_admin
drop policy if exists "deals_delete" on deals;
create policy "deals_delete" on deals
  for delete using (current_user_role() in ('super_admin','admin'));

-- ---- TASKS ----
drop policy if exists "Authenticated users can manage tasks" on tasks;
drop policy if exists "Authenticated users can view tasks"   on tasks;

create policy "tasks_select" on tasks
  for select using (
    is_manager()
    or assigned_to = auth.uid()
    or created_by  = auth.uid()
    or (deal_id is not null and can_see_deal(deal_id))
  );

create policy "tasks_insert" on tasks
  for insert with check (auth.uid() is not null);

create policy "tasks_update" on tasks
  for update using (
    is_manager()
    or assigned_to = auth.uid()
    or created_by  = auth.uid()
  );

create policy "tasks_delete" on tasks
  for delete using (
    is_manager() or created_by = auth.uid()
  );

-- ---- CONTACTS ---- (visibles si puedes ver algún deal de su empresa, o eres gerente)
drop policy if exists "Authenticated users can view contacts"   on contacts;
drop policy if exists "Authenticated users can insert contacts" on contacts;
drop policy if exists "Authenticated users can update contacts" on contacts;

create policy "contacts_select" on contacts
  for select using (
    is_manager()
    or exists (
      select 1 from deals d
      where d.company_id = contacts.company_id
        and (d.owner_id = auth.uid()
             or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid()))
    )
  );

create policy "contacts_insert" on contacts
  for insert with check (auth.uid() is not null);

create policy "contacts_update" on contacts
  for update using (
    is_manager()
    or exists (
      select 1 from deals d
      where d.company_id = contacts.company_id and d.owner_id = auth.uid()
    )
  );

-- ---- COMPANIES ---- (mismo criterio: gerente o tener un deal de esa empresa)
drop policy if exists "Authenticated users can view companies"   on companies;
drop policy if exists "Authenticated users can insert companies" on companies;
drop policy if exists "Authenticated users can update companies" on companies;

create policy "companies_select" on companies
  for select using (
    is_manager()
    or exists (
      select 1 from deals d
      where d.company_id = companies.id
        and (d.owner_id = auth.uid()
             or exists (select 1 from deal_members dm where dm.deal_id = d.id and dm.user_id = auth.uid()))
    )
  );

create policy "companies_insert" on companies
  for insert with check (auth.uid() is not null);

create policy "companies_update" on companies
  for update using (
    is_manager()
    or exists (select 1 from deals d where d.company_id = companies.id and d.owner_id = auth.uid())
  );

-- ---- INTERACTIONS ---- (atadas a un deal visible)
drop policy if exists "Authenticated users can view interactions"   on interactions;
drop policy if exists "Authenticated users can insert interactions" on interactions;

create policy "interactions_select" on interactions
  for select using (deal_id is null or can_see_deal(deal_id));

create policy "interactions_insert" on interactions
  for insert with check (auth.uid() is not null);


-- ────────────────────────────────────────────────────────────────
-- 3. MEDIO-1 — Notificaciones: solo gerentes notifican a terceros
--    (cada quien puede crear las suyas; gerentes a cualquiera)
-- ────────────────────────────────────────────────────────────────
drop policy if exists "notifications_insert_auth" on notifications;
create policy "notifications_insert_scoped" on notifications
  for insert with check (
    user_id = auth.uid()      -- crear notificación para uno mismo
    or is_manager()           -- o un gerente para cualquiera
  );


-- ════════════════════════════════════════════════════════════════
-- 4. ALTO-3 — Bucket de propuestas privado
--    (ejecutar en SQL Editor; afecta storage.objects)
-- ════════════════════════════════════════════════════════════════

-- Marcar el bucket como privado
update storage.buckets set public = false where id = 'propuestas';

-- Quitar políticas públicas previas si existían
drop policy if exists "propuestas_public_read" on storage.objects;

-- Leer/escribir propuestas solo usuarios autenticados
drop policy if exists "propuestas_auth_read"   on storage.objects;
drop policy if exists "propuestas_auth_write"  on storage.objects;

create policy "propuestas_auth_read" on storage.objects
  for select using (bucket_id = 'propuestas' and auth.uid() is not null);

create policy "propuestas_auth_write" on storage.objects
  for insert with check (bucket_id = 'propuestas' and auth.uid() is not null);

create policy "propuestas_auth_update" on storage.objects
  for update using (bucket_id = 'propuestas' and auth.uid() is not null);
