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
BEGIN

  -- ── Seguridad: ese ID debe existir tal cual en auth.users y profiles ──
  SELECT count(*) INTO v_keep_count
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.id = v_keep_id AND u.email = 'autopilotspa@gmail.com';

  IF v_keep_count != 1 THEN
    RAISE EXCEPTION 'No se encontró la cuenta esperada (id=%, email=autopilotspa@gmail.com). Abortando por seguridad — no se borró nada.', v_keep_id;
  END IF;

  -- ── Borrar todo en orden de dependencias ────────────────────
  DELETE FROM task_history;
  DELETE FROM tasks;
  DELETE FROM whatsapp_messages;
  DELETE FROM interactions;
  DELETE FROM pipeline_stage_history;
  DELETE FROM project_deliverables;
  DELETE FROM project_notes;
  DELETE FROM project_members;
  DELETE FROM projects;
  DELETE FROM deal_members;
  DELETE FROM team_messages;
  DELETE FROM direct_messages;
  DELETE FROM notifications;
  DELETE FROM automation_logs;
  DELETE FROM automation_rules;
  DELETE FROM audit_log;
  DELETE FROM user_activity_log;
  DELETE FROM user_sessions;
  DELETE FROM deals;
  DELETE FROM contacts;
  DELETE FROM companies;

  -- Limpiar jerarquía antes de borrar perfiles
  UPDATE profiles SET manager_id = NULL WHERE id <> v_keep_id;

  -- Dejar la cuenta que se conserva sin jefe ni sección filtrada (acceso total)
  UPDATE profiles SET manager_id = NULL, section_access = NULL WHERE id = v_keep_id;

  DELETE FROM profiles WHERE id <> v_keep_id;
  DELETE FROM auth.identities WHERE user_id <> v_keep_id;
  DELETE FROM auth.users WHERE id <> v_keep_id;

  RAISE NOTICE 'Reset completo. Única cuenta que queda: %', v_keep_id;

END $$;
