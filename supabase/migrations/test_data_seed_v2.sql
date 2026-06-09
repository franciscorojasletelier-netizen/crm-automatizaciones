-- ══════════════════════════════════════════════════════════════════
--  DATOS DE PRUEBA v2 — CRM Automatizaciones
--  Ejecutar en Supabase SQL Editor
--  Contraseña de todas las cuentas de prueba: CRM2024!
-- ══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- IDs usuarios
  v_gerente_id    uuid := gen_random_uuid();
  v_comercial_id  uuid := gen_random_uuid();
  v_produccion_id uuid := gen_random_uuid();
  v_soporte_id    uuid := gen_random_uuid();

  -- IDs empresas
  v_company1_id uuid := gen_random_uuid();
  v_company2_id uuid := gen_random_uuid();
  v_company3_id uuid := gen_random_uuid();
  v_company4_id uuid := gen_random_uuid();
  v_company5_id uuid := gen_random_uuid();
  v_company6_id uuid := gen_random_uuid();

  -- IDs contactos
  v_contact1_id uuid := gen_random_uuid();
  v_contact2_id uuid := gen_random_uuid();
  v_contact3_id uuid := gen_random_uuid();
  v_contact4_id uuid := gen_random_uuid();
  v_contact5_id uuid := gen_random_uuid();
  v_contact6_id uuid := gen_random_uuid();

  -- IDs deals (variedad de etapas)
  v_deal1_id  uuid := gen_random_uuid(); -- nuevo_lead
  v_deal2_id  uuid := gen_random_uuid(); -- calificado
  v_deal3_id  uuid := gen_random_uuid(); -- reunion_agendada
  v_deal4_id  uuid := gen_random_uuid(); -- propuesta_enviada
  v_deal5_id  uuid := gen_random_uuid(); -- negociacion
  v_deal6_id  uuid := gen_random_uuid(); -- cerrado_ganado (won)
  v_deal7_id  uuid := gen_random_uuid(); -- cerrado_perdido
  v_deal8_id  uuid := gen_random_uuid(); -- no_calificado
  v_deal9_id  uuid := gen_random_uuid(); -- frio
  v_deal10_id uuid := gen_random_uuid(); -- negociacion (del gerente)

BEGIN

-- ─────────────────────────────────────────────
-- 1. USUARIOS EN AUTH.USERS
-- ─────────────────────────────────────────────
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
  '{"provider":"email","providers":["email"]}', '{}', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_comercial_id,
  'authenticated', 'authenticated', 'comercial@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_produccion_id,
  'authenticated', 'authenticated', 'produccion@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', v_soporte_id,
  'authenticated', 'authenticated', 'soporte@autopilot.cl',
  crypt('CRM2024!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}', '', '', ''
)
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. IDENTIDADES (necesario para login email)
-- ─────────────────────────────────────────────
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
(gen_random_uuid(), v_gerente_id,    'gerente@autopilot.cl',
 '{"sub":"'||v_gerente_id::text||'","email":"gerente@autopilot.cl"}',    'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_comercial_id,  'comercial@autopilot.cl',
 '{"sub":"'||v_comercial_id::text||'","email":"comercial@autopilot.cl"}','email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_produccion_id, 'produccion@autopilot.cl',
 '{"sub":"'||v_produccion_id::text||'","email":"produccion@autopilot.cl"}','email', NOW(), NOW(), NOW()),
(gen_random_uuid(), v_soporte_id,    'soporte@autopilot.cl',
 '{"sub":"'||v_soporte_id::text||'","email":"soporte@autopilot.cl"}',    'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. PERFILES
-- ─────────────────────────────────────────────
INSERT INTO profiles (id, full_name, email, role, is_active) VALUES
(v_gerente_id,    'Carlos Mendoza',  'gerente@autopilot.cl',    'gerente',    true),
(v_comercial_id,  'Ana Torres',      'comercial@autopilot.cl',  'comercial',  true),
(v_produccion_id, 'Diego Ramírez',   'produccion@autopilot.cl', 'produccion', true),
(v_soporte_id,    'Laura Vega',      'soporte@autopilot.cl',    'soporte',    true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role      = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────
-- 4. EMPRESAS
-- ─────────────────────────────────────────────
INSERT INTO companies (id, name, industry, website, phone) VALUES
(v_company1_id, 'TechSolutions SpA',      'Tecnología',   'https://techsolutions.cl',    '+56912345678'),
(v_company2_id, 'Distribuidora Norte SA', 'Distribución', 'https://distnorte.cl',        '+56987654321'),
(v_company3_id, 'Clínica Bienestar',      'Salud',        'https://clinicabienestar.cl', '+56911223344'),
(v_company4_id, 'Constructora Del Sol',   'Construcción', 'https://delsol.cl',           '+56955667788'),
(v_company5_id, 'Retail Express Ltda',    'Retail',       'https://retailexpress.cl',    '+56933445566'),
(v_company6_id, 'Agro del Sur SA',        'Agricultura',  'https://agrodelsur.cl',       '+56977889900')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. CONTACTOS
-- ─────────────────────────────────────────────
INSERT INTO contacts (id, full_name, email, phone, position, company_id) VALUES
(v_contact1_id, 'Roberto Silva',     'rsilva@techsolutions.cl',     '+56912345670', 'CEO',               v_company1_id),
(v_contact2_id, 'María González',    'mgonzalez@distnorte.cl',      '+56987654320', 'Gerente Compras',   v_company2_id),
(v_contact3_id, 'Dr. Pablo Rojas',   'projas@clinicabienestar.cl',  '+56911223340', 'Director Médico',   v_company3_id),
(v_contact4_id, 'Camila Fuentes',    'cfuentes@delsol.cl',          '+56955667780', 'Jefa de Proyectos', v_company4_id),
(v_contact5_id, 'Sebastián Mora',    'smora@retailexpress.cl',      '+56933445560', 'CTO',               v_company5_id),
(v_contact6_id, 'Valentina Parra',   'vparra@agrodelsur.cl',        '+56977889890', 'Gerente General',   v_company6_id)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. DEALS — Todos los estados posibles
-- ─────────────────────────────────────────────
INSERT INTO deals (
  id, company_id, primary_contact_id, owner_id,
  stage, status, estimated_value, probability, source,
  next_action, score, created_at, last_contacted_at
) VALUES
-- 1. Nuevo Lead (recién ingresado)
(
  v_deal1_id, v_company1_id, v_contact1_id, v_comercial_id,
  'nuevo_lead', 'open', 1200000, 10, 'LinkedIn',
  'Primera llamada de contacto esta semana',
  25, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
),
-- 2. Calificado
(
  v_deal2_id, v_company2_id, v_contact2_id, v_comercial_id,
  'calificado', 'open', 3800000, 35, 'Referido',
  'Enviar brochure y caso de éxito similar',
  55, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'
),
-- 3. Reunión Agendada
(
  v_deal3_id, v_company3_id, v_contact3_id, v_comercial_id,
  'reunion_agendada', 'open', 5500000, 50, 'Sitio web',
  'Demo el miércoles 11 de junio a las 10:00 AM',
  65, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'
),
-- 4. Propuesta Enviada
(
  v_deal4_id, v_company4_id, v_contact4_id, v_comercial_id,
  'propuesta_enviada', 'open', 7200000, 60, 'Evento',
  'Hacer seguimiento de la propuesta enviada el lunes',
  72, NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days'
),
-- 5. En Negociación
(
  v_deal5_id, v_company5_id, v_contact5_id, v_comercial_id,
  'negociacion', 'open', 4900000, 75, 'Cold outreach',
  'Revisar descuento solicitado con gerencia',
  80, NOW() - INTERVAL '18 days', NOW() - INTERVAL '1 day'
),
-- 6. Ganado ✓
(
  v_deal6_id, v_company6_id, v_contact6_id, v_comercial_id,
  'cerrado_ganado', 'won', 9800000, 100, 'Referido',
  'Coordinar inicio de proyecto con producción',
  95, NOW() - INTERVAL '25 days', NOW() - INTERVAL '2 days'
),
-- 7. Perdido (con razón)
(
  v_deal7_id, v_company1_id, v_contact1_id, v_comercial_id,
  'cerrado_perdido', 'lost', 2500000, 0, 'LinkedIn',
  NULL,
  15, NOW() - INTERVAL '30 days', NOW() - INTERVAL '10 days'
),
-- 8. No Calificado
(
  v_deal8_id, v_company2_id, v_contact2_id, v_comercial_id,
  'no_calificado', 'lost', 800000, 0, 'Cold outreach',
  NULL,
  10, NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days'
),
-- 9. Frío (pausado)
(
  v_deal9_id, v_company3_id, v_contact3_id, v_comercial_id,
  'frio', 'open', 6100000, 20, 'Sitio web',
  'Retomar contacto en agosto cuando termina su contrato actual',
  30, NOW() - INTERVAL '45 days', NOW() - INTERVAL '20 days'
),
-- 10. Negociación (del gerente — para probar visibilidad)
(
  v_deal10_id, v_company4_id, v_contact4_id, v_gerente_id,
  'propuesta_enviada', 'open', 15000000, 65, 'Evento',
  'Reunión de cierre con directorio el viernes',
  88, NOW() - INTERVAL '22 days', NOW() - INTERVAL '1 day'
)
ON CONFLICT DO NOTHING;

-- Actualizar razones de pérdida en deals cerrados
UPDATE deals SET
  lost_reason  = 'precio',
  lost_comment = 'El cliente eligió un competidor con precio 30% menor. No pudimos igualar sin perder margen.'
WHERE id = v_deal7_id;

UPDATE deals SET
  lost_reason  = 'sin_presupuesto',
  lost_comment = 'La empresa recortó presupuesto de tecnología para este año. Puede reactivarse en 2026.'
WHERE id = v_deal8_id;

UPDATE deals SET
  lost_reason  = 'sin_urgencia',
  lost_comment = 'El cliente tiene contrato vigente con proveedor actual hasta agosto. Volver a contactar en julio.'
WHERE id = v_deal9_id;

-- ─────────────────────────────────────────────
-- 7. VISIBILIDAD (deal_members)
-- ─────────────────────────────────────────────
INSERT INTO deal_members (deal_id, user_id) VALUES
(v_deal1_id,  v_comercial_id),
(v_deal2_id,  v_comercial_id),
(v_deal3_id,  v_comercial_id),
(v_deal4_id,  v_comercial_id),
(v_deal5_id,  v_comercial_id),
(v_deal6_id,  v_comercial_id),
(v_deal7_id,  v_comercial_id),
(v_deal8_id,  v_comercial_id),
(v_deal9_id,  v_comercial_id),
(v_deal10_id, v_gerente_id),
(v_deal10_id, v_comercial_id)  -- comercial también puede ver el deal del gerente
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 8. TAREAS — Variedad de fechas y prioridades
-- ─────────────────────────────────────────────
INSERT INTO tasks (title, deal_id, assigned_to, due_date, is_completed, priority) VALUES

-- ══ ANA TORRES (comercial) ══

-- Para mañana (recibirá email del cron)
('Llamar a Roberto Silva — primera presentación',
  v_deal1_id, v_comercial_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Enviar brochure y caso de éxito a Distribuidora Norte',
  v_deal2_id, v_comercial_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Confirmar asistencia demo Clínica Bienestar',
  v_deal3_id, v_comercial_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),

-- Para esta semana
('Seguimiento propuesta Constructora Del Sol',
  v_deal4_id, v_comercial_id, (NOW() + INTERVAL '3 days')::date::timestamptz, false, 'alta'),
('Revisar descuento con gerencia — Retail Express',
  v_deal5_id, v_comercial_id, (NOW() + INTERVAL '2 days')::date::timestamptz, false, 'alta'),
('Coordinar kickoff Agro del Sur con producción',
  v_deal6_id, v_comercial_id, (NOW() + INTERVAL '4 days')::date::timestamptz, false, 'media'),

-- Vencidas (generarán alerta ⚠️ en el email)
('Actualizar CRM con notas de reuniones de la semana pasada',
  NULL, v_comercial_id, NOW() - INTERVAL '3 days', false, 'baja'),
('Enviar contrato revisado a Retail Express',
  v_deal5_id, v_comercial_id, NOW() - INTERVAL '2 days', false, 'alta'),

-- Completadas (no aparecerán en el email)
('Llamada inicial con Clínica Bienestar',
  v_deal3_id, v_comercial_id, NOW() - INTERVAL '5 days', true, 'media'),

-- ══ CARLOS MENDOZA (gerente) ══

-- Para mañana
('Revisar pipeline de ventas semanal',
  NULL, v_gerente_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Aprobar propuesta $15M — Constructora del Sol',
  v_deal10_id, v_gerente_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Reunión de cierre con directorio Constructora',
  v_deal10_id, v_gerente_id, (NOW() + INTERVAL '2 days')::date::timestamptz, false, 'alta'),

-- Vencidas
('Enviar reporte mensual de KPIs al directorio',
  NULL, v_gerente_id, NOW() - INTERVAL '1 day', false, 'alta'),

-- ══ DIEGO RAMÍREZ (producción) ══

-- Para mañana
('Revisar entregables Q2 — proyecto Agro del Sur',
  NULL, v_produccion_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),
('Actualizar horas reales en proyectos activos',
  NULL, v_produccion_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'baja'),

-- Para esta semana
('Preparar documento de especificaciones técnicas Agro del Sur',
  NULL, v_produccion_id, (NOW() + INTERVAL '3 days')::date::timestamptz, false, 'alta'),

-- ══ LAURA VEGA (soporte) ══

-- Para mañana
('Responder tickets pendientes del fin de semana',
  NULL, v_soporte_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'alta'),
('Documentar solución incidencia #4821',
  NULL, v_soporte_id, (NOW() + INTERVAL '1 day')::date::timestamptz, false, 'media'),

-- Vencida
('Enviar reporte semanal de soporte',
  NULL, v_soporte_id, NOW() - INTERVAL '1 day', false, 'media')

ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- RESUMEN
-- ──────────────────────────────────────────────────────────────────
-- CUENTAS:
--   gerente@autopilot.cl    / CRM2024! / Gerente
--   comercial@autopilot.cl  / CRM2024! / Comercial
--   produccion@autopilot.cl / CRM2024! / Producción
--   soporte@autopilot.cl    / CRM2024! / Soporte
--
-- DEALS (10 en total):
--   nuevo_lead        → TechSolutions SpA
--   calificado        → Distribuidora Norte SA
--   reunion_agendada  → Clínica Bienestar
--   propuesta_enviada → Constructora Del Sol
--   negociacion       → Retail Express Ltda
--   cerrado_ganado    → Agro del Sur SA (deal WON)
--   cerrado_perdido   → TechSolutions SpA (razón: precio)
--   no_calificado     → Distribuidora Norte SA (razón: sin presupuesto)
--   frio              → Clínica Bienestar (razón: sin urgencia)
--   propuesta_enviada → Constructora Del Sol (deal del gerente)
--
-- TAREAS:
--   Ana Torres    → 9 tareas (3 para mañana, 3 esta semana, 2 vencidas, 1 completa)
--   Carlos Mendoza→ 4 tareas (3 para mañana/semana, 1 vencida)
--   Diego Ramírez → 3 tareas (2 para mañana, 1 semana)
--   Laura Vega    → 3 tareas (2 para mañana, 1 vencida)
-- ══════════════════════════════════════════════════════════════════

END $$;
