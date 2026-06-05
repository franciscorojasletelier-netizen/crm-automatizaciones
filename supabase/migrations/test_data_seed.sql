-- ══════════════════════════════════════════════════════════════════
--  DATOS DE PRUEBA — CRM Automatizaciones
--  Ejecutar en Supabase SQL Editor
--  Contraseña de todas las cuentas: CRM2024!
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CREAR USUARIOS DE PRUEBA EN AUTH
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_gerente_id    uuid := gen_random_uuid();
  v_comercial_id  uuid := gen_random_uuid();
  v_produccion_id uuid := gen_random_uuid();
  v_soporte_id    uuid := gen_random_uuid();

  v_company1_id   uuid := gen_random_uuid();
  v_company2_id   uuid := gen_random_uuid();
  v_company3_id   uuid := gen_random_uuid();
  v_company4_id   uuid := gen_random_uuid();

  v_contact1_id   uuid := gen_random_uuid();
  v_contact2_id   uuid := gen_random_uuid();
  v_contact3_id   uuid := gen_random_uuid();
  v_contact4_id   uuid := gen_random_uuid();

  v_deal1_id      uuid := gen_random_uuid();
  v_deal2_id      uuid := gen_random_uuid();
  v_deal3_id      uuid := gen_random_uuid();
  v_deal4_id      uuid := gen_random_uuid();
  v_deal5_id      uuid := gen_random_uuid();

BEGIN

-- ── Insertar en auth.users ──────────────────────────────────────

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new
) VALUES
(
  '00000000-0000-0000-0000-000000000000', v_gerente_id,
  'authenticated', 'authenticated', 'gerente@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_comercial_id,
  'authenticated', 'authenticated', 'comercial@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_produccion_id,
  'authenticated', 'authenticated', 'produccion@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_soporte_id,
  'authenticated', 'authenticated', 'soporte@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', ''
)
ON CONFLICT (email) DO NOTHING;

-- ── Insertar identidades (necesario para login con email) ────────
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
(gen_random_uuid(), v_gerente_id,    'gerente@autopilot.cl',    '{"sub":"' || v_gerente_id::text    || '","email":"gerente@autopilot.cl"}',    'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_comercial_id,  'comercial@autopilot.cl',  '{"sub":"' || v_comercial_id::text  || '","email":"comercial@autopilot.cl"}',  'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_produccion_id, 'produccion@autopilot.cl', '{"sub":"' || v_produccion_id::text || '","email":"produccion@autopilot.cl"}', 'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_soporte_id,    'soporte@autopilot.cl',    '{"sub":"' || v_soporte_id::text    || '","email":"soporte@autopilot.cl"}',    'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── Insertar perfiles ─────────────────────────────────────────────
INSERT INTO profiles (id, full_name, email, role, is_active) VALUES
(v_gerente_id,    'Carlos Mendoza',   'gerente@autopilot.cl',    'gerente',    true),
(v_comercial_id,  'Ana Torres',       'comercial@autopilot.cl',  'comercial',  true),
(v_produccion_id, 'Diego Ramírez',    'produccion@autopilot.cl', 'produccion', true),
(v_soporte_id,    'Laura Vega',       'soporte@autopilot.cl',    'soporte',    true)
ON CONFLICT (id) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  role       = EXCLUDED.role,
  is_active  = EXCLUDED.is_active;

-- ─────────────────────────────────────────────
-- 2. EMPRESAS DE PRUEBA
-- ─────────────────────────────────────────────
INSERT INTO companies (id, name, industry, website, phone) VALUES
(v_company1_id, 'TechSolutions SpA',      'Tecnología',     'https://techsolutions.cl',   '+56912345678'),
(v_company2_id, 'Distribuidora Norte SA', 'Distribución',   'https://distnorte.cl',       '+56987654321'),
(v_company3_id, 'Clínica Bienestar',      'Salud',          'https://clinicabienestar.cl','+56911223344'),
(v_company4_id, 'Constructora Del Sol',   'Construcción',   'https://delsol.cl',          '+56955667788')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. CONTACTOS DE PRUEBA
-- ─────────────────────────────────────────────
INSERT INTO contacts (id, full_name, email, phone, position, company_id) VALUES
(v_contact1_id, 'Roberto Silva',    'rsilva@techsolutions.cl',  '+56912345670', 'CEO',              v_company1_id),
(v_contact2_id, 'María González',   'mgonzalez@distnorte.cl',   '+56987654320', 'Gerente Compras',  v_company2_id),
(v_contact3_id, 'Dr. Pablo Rojas',  'projas@clinicabienestar.cl','+56911223340','Director Médico',  v_company3_id),
(v_contact4_id, 'Camila Fuentes',   'cfuentes@delsol.cl',       '+56955667780', 'Jefa de Proyectos',v_company4_id)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. LEADS / DEALS DE PRUEBA
-- ─────────────────────────────────────────────
INSERT INTO deals (
  id, company_id, primary_contact_id, owner_id,
  stage, status, estimated_value, probability, source,
  next_action, score, created_at
) VALUES
(
  v_deal1_id, v_company1_id, v_contact1_id, v_comercial_id,
  'calificado', 'open', 4500000, 40, 'LinkedIn',
  'Enviar propuesta técnica este viernes',
  72, NOW() - INTERVAL '5 days'
),
(
  v_deal2_id, v_company2_id, v_contact2_id, v_comercial_id,
  'reunion_agendada', 'open', 2800000, 60, 'Referido',
  'Reunión demo el martes a las 10:00',
  58, NOW() - INTERVAL '10 days'
),
(
  v_deal3_id, v_company3_id, v_contact3_id, v_comercial_id,
  'negociacion', 'open', 7200000, 75, 'Sitio web',
  'Revisar contrato y enviar versión ajustada',
  85, NOW() - INTERVAL '15 days'
),
(
  v_deal4_id, v_company4_id, v_contact4_id, v_comercial_id,
  'nuevo_lead', 'open', 1500000, 20, 'Cold outreach',
  'Hacer llamada de descubrimiento',
  30, NOW() - INTERVAL '2 days'
),
(
  v_deal5_id, v_company1_id, v_contact1_id, v_gerente_id,
  'propuesta_enviada', 'open', 9800000, 55, 'Evento',
  'Seguimiento propuesta enviada hace 3 días',
  68, NOW() - INTERVAL '20 days'
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. TAREAS PENDIENTES (para mañana y hoy)
--    Para testear notificación diaria por email
-- ─────────────────────────────────────────────
INSERT INTO tasks (title, deal_id, assigned_to, due_date, is_completed, priority) VALUES

-- Tareas de ANA TORRES (comercial) — para mañana
('Enviar propuesta técnica a TechSolutions',    v_deal1_id, v_comercial_id,  (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Preparar demo para Distribuidora Norte',       v_deal2_id, v_comercial_id,  (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Revisar y ajustar contrato Clínica Bienestar', v_deal3_id, v_comercial_id,  (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),
('Llamada de descubrimiento con Constructora',   v_deal4_id, v_comercial_id,  (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),

-- Tareas de CARLOS MENDOZA (gerente) — para mañana
('Revisar pipeline de ventas semanal',           NULL,        v_gerente_id,   (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Seguimiento propuesta TechSolutions $9.8M',    v_deal5_id,  v_gerente_id,   (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),

-- Tareas vencidas (para probar alertas)
('Actualizar CRM con información de reuniones',  NULL,        v_comercial_id,  NOW() - INTERVAL '2 days', false, 'baja'),
('Enviar reporte mensual al gerente',            NULL,        v_soporte_id,    NOW() - INTERVAL '1 day',  false, 'media'),

-- Tareas de DIEGO RAMÍREZ (producción) — para mañana
('Revisar entregables proyecto TechSolutions',   NULL,        v_produccion_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),
('Actualizar horas reales en proyectos activos', NULL,        v_produccion_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'baja')

ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. ASIGNAR VISIBILIDAD (deal_members)
-- ─────────────────────────────────────────────
INSERT INTO deal_members (deal_id, user_id) VALUES
(v_deal1_id, v_comercial_id),
(v_deal2_id, v_comercial_id),
(v_deal3_id, v_comercial_id),
(v_deal4_id, v_comercial_id),
(v_deal5_id, v_gerente_id)
ON CONFLICT DO NOTHING;

END $$;

-- ══════════════════════════════════════════════════════════════════
-- RESUMEN DE CUENTAS CREADAS
-- Email / Contraseña / Rol
-- ──────────────────────────────────────────────────────────────────
-- gerente@autopilot.cl    / CRM2024! / Gerente
-- comercial@autopilot.cl  / CRM2024! / Ejecutivo de Ventas
-- produccion@autopilot.cl / CRM2024! / Producción
-- soporte@autopilot.cl    / CRM2024! / Soporte / Analista
-- ══════════════════════════════════════════════════════════════════
