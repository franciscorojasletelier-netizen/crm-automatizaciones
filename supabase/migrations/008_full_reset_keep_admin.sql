-- ============================================================
--  RESET TOTAL — deja el CRM en blanco, conserva SOLO la cuenta
--  admin con email autopilotspa@gmail.com
--  ⚠️⚠️ IRREVERSIBLE — borra TODOS los leads, empresas, tareas,
--  proyectos, mensajes, automatizaciones, notificaciones, logs.
--  Ejecutar en Supabase → SQL Editor
-- ============================================================

DO $$
DECLARE
  -- ID confirmado de la cuenta a conservar (autopilotspa@gmail.com, rol admin)
  v_keep_id uuid := 'be6ed719-e19f-44cb-9649-f4f32a30a347';
  v_keep_count int;
  v_table text;
  v_tables text[] := ARRAY[
    'task_history', 'tasks', 'whatsapp_messages', 'interactions',
    'pipeline_stage_history', 'project_deliverables', 'project_notes',
    'project_members', 'projects', 'deal_members', 'team_messages',
    'direct_messages', 'notifications', 'automation_logs', 'automation_rules',
    'audit_log', 'user_activity_log', 'user_sessions', 'deals', 'contacts', 'companies'
  ];
BEGIN

  -- ── Seguridad: ese ID debe existir tal cual en auth.users y profiles ──
  SELECT count(*) INTO v_keep_count
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.id = v_keep_id AND u.email = 'autopilotspa@gmail.com';

  IF v_keep_count != 1 THEN
    RAISE EXCEPTION 'No se encontró la cuenta esperada (id=%, email=autopilotspa@gmail.com). Abortando por seguridad — no se borró nada.', v_keep_id;
  END IF;

  -- ── Borrar todo en orden de dependencias, saltando tablas que no existan ──
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      EXECUTE format('DELETE FROM %I', v_table);
      RAISE NOTICE 'Borrado: %', v_table;
    ELSE
      RAISE NOTICE 'Tabla % no existe, se omite', v_table;
    END IF;
  END LOOP;

  -- Limpiar jerarquía antes de borrar perfiles
  UPDATE profiles SET manager_id = NULL WHERE id <> v_keep_id;

  -- Dejar la cuenta que se conserva sin jefe ni sección filtrada (acceso total)
  UPDATE profiles SET manager_id = NULL, section_access = NULL WHERE id = v_keep_id;

  DELETE FROM profiles WHERE id <> v_keep_id;
  DELETE FROM auth.identities WHERE user_id <> v_keep_id;
  DELETE FROM auth.users WHERE id <> v_keep_id;

  RAISE NOTICE 'Reset completo. Única cuenta que queda: %', v_keep_id;

END $$;
