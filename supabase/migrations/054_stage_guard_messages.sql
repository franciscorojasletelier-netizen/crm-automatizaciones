-- 054 — Mensajes de la protección de etapas en español de Chile (tenían voseo).
create or replace function public.guard_pipeline_stage_update() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.key is distinct from old.key then
    raise exception 'La clave de una etapa no se puede cambiar (% → %). Es un identificador técnico: edita el nombre visible.', old.key, new.key;
  end if;

  if old.is_active and not new.is_active then
    if old.is_default then
      raise exception 'No se puede desactivar la etapa por defecto. Primero marca otra etapa como la de inicio.';
    end if;
    if old.is_won then
      raise exception 'No se puede desactivar la etapa de ganado. Primero marca otra etapa como ganada.';
    end if;
  end if;

  return new;
end;
$$;
