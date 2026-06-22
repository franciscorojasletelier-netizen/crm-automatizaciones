-- ============================================================
--  LIMPIEZA DE DATOS DE PRUEBA — deja el CRM listo para uso real
--  Elimina ÚNICAMENTE lo sembrado por test_data_seed.sql y
--  test_data_seed_v2.sql (usuarios, empresas, contactos, deals,
--  tareas y todo lo que cuelga de ellos).
--  Ejecutar en Supabase → SQL Editor
--  ⚠️ IRREVERSIBLE — revisa la lista antes de correrlo.
-- ============================================================

DO $$
DECLARE
  v_user_ids   uuid[];
  v_company_ids uuid[];
  v_deal_ids   uuid[];
  v_project_ids uuid[];
BEGIN

  -- IDs de los 4 usuarios de prueba
  SELECT array_agg(id) INTO v_user_ids
  FROM profiles
  WHERE email IN (
    'gerente@autopilot.cl', 'comercial@autopilot.cl',
    'produccion@autopilot.cl', 'soporte@autopilot.cl'
  );

  -- IDs de las 6 empresas ficticias
  SELECT array_agg(id) INTO v_company_ids
  FROM companies
  WHERE name IN (
    'TechSolutions SpA', 'Distribuidora Norte SA', 'Clínica Bienestar',
    'Constructora Del Sol', 'Retail Express Ltda', 'Agro del Sur SA'
  );

  -- IDs de deals ligados a esas empresas
  SELECT array_agg(id) INTO v_deal_ids
  FROM deals
  WHERE company_id = ANY(v_company_ids);

  -- IDs de proyectos generados desde esos deals
  SELECT array_agg(id) INTO v_project_ids
  FROM projects
  WHERE deal_id = ANY(v_deal_ids);

  -- ── Borrar en orden de dependencias ──────────────────────────
  DELETE FROM task_history       WHERE task_id IN (SELECT id FROM tasks WHERE deal_id = ANY(v_deal_ids) OR assigned_to = ANY(v_user_ids) OR created_by = ANY(v_user_ids));
  DELETE FROM tasks              WHERE deal_id = ANY(v_deal_ids) OR assigned_to = ANY(v_user_ids) OR created_by = ANY(v_user_ids);
  DELETE FROM interactions       WHERE deal_id = ANY(v_deal_ids);
  DELETE FROM pipeline_stage_history WHERE deal_id = ANY(v_deal_ids);
  DELETE FROM project_deliverables WHERE project_id = ANY(v_project_ids);
  DELETE FROM project_notes      WHERE project_id = ANY(v_project_ids);
  DELETE FROM project_members    WHERE project_id = ANY(v_project_ids);
  DELETE FROM projects           WHERE id = ANY(v_project_ids);
  DELETE FROM deal_members       WHERE deal_id = ANY(v_deal_ids);
  DELETE FROM team_messages      WHERE deal_id = ANY(v_deal_ids) OR user_id = ANY(v_user_ids);
  DELETE FROM direct_messages    WHERE sender_id = ANY(v_user_ids) OR recipient_id = ANY(v_user_ids);
  DELETE FROM notifications      WHERE user_id = ANY(v_user_ids);
  DELETE FROM deals              WHERE id = ANY(v_deal_ids);
  DELETE FROM contacts           WHERE company_id = ANY(v_company_ids);
  DELETE FROM companies          WHERE id = ANY(v_company_ids);

  -- Quitar manager_id de perfiles reales que pudieran apuntar a un usuario de prueba
  UPDATE profiles SET manager_id = NULL WHERE manager_id = ANY(v_user_ids);

  DELETE FROM profiles           WHERE id = ANY(v_user_ids);
  DELETE FROM auth.identities    WHERE user_id = ANY(v_user_ids);
  DELETE FROM auth.users         WHERE id = ANY(v_user_ids);

  RAISE NOTICE 'Usuarios de prueba eliminados: %', v_user_ids;
  RAISE NOTICE 'Empresas de prueba eliminadas: %', v_company_ids;
  RAISE NOTICE 'Deals de prueba eliminados: %', v_deal_ids;

END $$;
