-- Grant permisos a pipeline_stage_history para el trigger de cambio de etapa
grant select, insert on pipeline_stage_history to authenticated;

drop policy if exists "Authenticated users can insert pipeline history" on pipeline_stage_history;
create policy "Authenticated users can insert pipeline history"
  on pipeline_stage_history for insert with check (auth.uid() is not null);
