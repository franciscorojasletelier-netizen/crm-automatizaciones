-- ============================================================
--  FIX: set_default_stage / set_won_stage podían violar el índice
--  único parcial (idx_stage_one_default / idx_stage_one_won).
--
--  La versión anterior hacía UN solo UPDATE:
--    update pipeline_stages set is_default = (id = p_stage_id)
--     where organization_id = p_org_id;
--
--  El razonamiento original era "una sola sentencia se valida recién
--  al final, así que funciona" — ESO ES INCORRECTO. Los índices
--  únicos parciales se validan fila por fila a medida que Postgres
--  las procesa dentro de la sentencia, no al final de la sentencia
--  completa, y Postgres NO garantiza el orden en que procesa las
--  filas de un UPDATE multi-fila. Si llega a poner en true la fila
--  nueva ANTES de poner en false la vieja, el índice choca ahí mismo
--  ("duplicate key value violates unique constraint
--  idx_stage_one_default") aunque el resultado final de la sentencia
--  hubiera sido válido.
--
--  Los índices únicos parciales tampoco admiten DEFERRABLE en
--  Postgres (eso es solo para constraints de PK/UNIQUE/EXCLUDE sin
--  WHERE), así que no se puede posponer la validación al commit.
--
--  Fix real: DOS sentencias separadas. La primera pone todo en false
--  (nunca puede violar "como mucho una fila en true"). La segunda
--  pone en true únicamente la fila elegida — en ese momento ya no
--  hay ninguna otra fila en true, así que no puede haber conflicto.
-- ============================================================

begin;

create or replace function set_default_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  if not exists (
    select 1 from pipeline_stages
     where id = p_stage_id and organization_id = p_org_id and is_active
  ) then
    raise exception 'La etapa no existe, no está activa, o no pertenece a esta organización';
  end if;

  update pipeline_stages set is_default = false where organization_id = p_org_id and is_default;
  update pipeline_stages set is_default = true  where id = p_stage_id;
end;
$$;

create or replace function set_won_stage(p_org_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_owner() then
    raise exception 'Sin permiso para configurar el embudo';
  end if;

  if not exists (
    select 1 from pipeline_stages
     where id = p_stage_id and organization_id = p_org_id
       and is_active and is_terminal and not is_lost
  ) then
    raise exception 'La etapa de ganado debe existir, estar activa, ser terminal y no estar marcada como perdida';
  end if;

  update pipeline_stages set is_won = false where organization_id = p_org_id and is_won;
  update pipeline_stages set is_won = true  where id = p_stage_id;
end;
$$;

commit;
