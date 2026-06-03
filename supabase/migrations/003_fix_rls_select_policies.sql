-- Corregir politicas SELECT que aun usan auth.role()

drop policy if exists "Authenticated users can view companies" on companies;
create policy "Authenticated users can view companies"
  on companies for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view contacts" on contacts;
create policy "Authenticated users can view contacts"
  on contacts for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view deals" on deals;
create policy "Authenticated users can view deals"
  on deals for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view interactions" on interactions;
create policy "Authenticated users can view interactions"
  on interactions for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view tasks" on tasks;
create policy "Authenticated users can view tasks"
  on tasks for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view pipeline history" on pipeline_stage_history;
create policy "Authenticated users can view pipeline history"
  on pipeline_stage_history for select using (auth.uid() is not null);

drop policy if exists "Authenticated users can view audit log" on audit_log;
create policy "Authenticated users can view audit log"
  on audit_log for select using (auth.uid() is not null);

drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can view profiles"
  on profiles for select using (auth.uid() is not null);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() is not null);
