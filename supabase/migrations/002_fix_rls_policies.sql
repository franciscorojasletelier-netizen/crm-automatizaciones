-- Fix RLS policies: usar auth.uid() IS NOT NULL en lugar de auth.role() = 'authenticated'
-- Las nuevas claves sb_publishable_* manejan el JWT distinto a las claves legacy

drop policy if exists "Authenticated users can insert companies" on companies;
drop policy if exists "Authenticated users can update companies" on companies;
create policy "Authenticated users can insert companies"
  on companies for insert with check (auth.uid() is not null);
create policy "Authenticated users can update companies"
  on companies for update using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert contacts" on contacts;
drop policy if exists "Authenticated users can update contacts" on contacts;
create policy "Authenticated users can insert contacts"
  on contacts for insert with check (auth.uid() is not null);
create policy "Authenticated users can update contacts"
  on contacts for update using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert deals" on deals;
drop policy if exists "Authenticated users can update deals" on deals;
create policy "Authenticated users can insert deals"
  on deals for insert with check (auth.uid() is not null);
create policy "Authenticated users can update deals"
  on deals for update using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert interactions" on interactions;
create policy "Authenticated users can insert interactions"
  on interactions for insert with check (auth.uid() is not null);

drop policy if exists "Authenticated users can manage tasks" on tasks;
create policy "Authenticated users can manage tasks"
  on tasks for all using (auth.uid() is not null);

drop policy if exists "System can insert activity" on user_activity_log;
create policy "System can insert activity"
  on user_activity_log for insert with check (auth.uid() is not null);
