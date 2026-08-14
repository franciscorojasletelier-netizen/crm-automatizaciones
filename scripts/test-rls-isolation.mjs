// Suite de tests automatizados de aislamiento multi-tenant (RLS).
//
// Crea 2 organizaciones + 2 usuarios reales de prueba, carga datos en la
// organización A, y verifica activamente — usando el cliente ANON (el mismo
// que usa el navegador, sujeto a RLS) logueado como el usuario de la
// organización B — que:
//   1. No puede LEER ningún dato de la organización A (companies/contacts/deals/tasks).
//   2. No puede INSERTAR una fila declarando explícitamente organization_id
//      de la organización A (verifica el fix de los triggers set_org_from_*).
// Al final borra todo lo que creó, incluso si algún assert falla.
//
// Uso:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   node scripts/test-rls-isolation.mjs
//
// O agregar las mismas env vars a .env.local y correr: npm run test:rls
// Sale con exit code 1 si algún assert falla — pensado para correr en CI
// cada vez que se toque una política RLS.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Faltan env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
function assert(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail })
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`)
}

const stamp = Date.now()
const state = { orgA: null, orgB: null, userA: null, userB: null }

// Cada insert de setup es indispensable para el resto del test — si uno
// falla en silencio (como pasaba antes, destructurando solo `data`), el
// error real queda oculto y el fallo aparece páginas después como un
// "Cannot read properties of null" sin pista de la causa. Se corta acá,
// con el mensaje de Postgres/RLS tal cual.
function must(label, { data, error }) {
  if (error || !data) {
    throw new Error(`setup — ${label}: ${error?.message ?? '(sin datos devueltos)'}`)
  }
  return data
}

async function setup() {
  const orgA = must('crear organización A', await admin.from('organizations').insert({ name: `TEST-A-${stamp}` }).select('id').single())
  const orgB = must('crear organización B', await admin.from('organizations').insert({ name: `TEST-B-${stamp}` }).select('id').single())
  state.orgA = orgA.id
  state.orgB = orgB.id

  // Crear la organización a mano (insert directo, no vía
  // /api/platform/create-organization) NO siembra su embudo — eso solo
  // pasa en esa ruta de la app. Sin esto, cualquier insert de un deal con
  // `stage` explícito revienta la FK compuesta `deals_stage_fk`, y
  // testPipelineInvariants() (que asume que ya existen etapas) también falla.
  const { error: seedAErr } = await admin.rpc('seed_default_stages', { p_org_id: state.orgA })
  if (seedAErr) throw new Error(`setup — sembrar etapas de la org A: ${seedAErr.message}`)
  const { error: seedBErr } = await admin.rpc('seed_default_stages', { p_org_id: state.orgB })
  if (seedBErr) throw new Error(`setup — sembrar etapas de la org B: ${seedBErr.message}`)

  const pass = 'TestRLS!2026xk'

  const { data: authA, error: authAErr } = await admin.auth.admin.createUser({
    email: `rls-test-a-${stamp}@example.invalid`, password: pass, email_confirm: true,
  })
  if (authAErr) throw new Error(`setup — crear usuario A: ${authAErr.message}`)
  const { data: authB, error: authBErr } = await admin.auth.admin.createUser({
    email: `rls-test-b-${stamp}@example.invalid`, password: pass, email_confirm: true,
  })
  if (authBErr) throw new Error(`setup — crear usuario B: ${authBErr.message}`)
  state.userA = { id: authA.user.id, email: authA.user.email, password: pass }
  state.userB = { id: authB.user.id, email: authB.user.email, password: pass }

  const { error: profAErr } = await admin.from('profiles').insert({
    id: state.userA.id, full_name: 'RLS Test A', email: state.userA.email,
    role: 'super_admin', is_active: true, organization_id: state.orgA,
  })
  if (profAErr) throw new Error(`setup — crear perfil A: ${profAErr.message}`)
  const { error: profBErr } = await admin.from('profiles').insert({
    id: state.userB.id, full_name: 'RLS Test B', email: state.userB.email,
    role: 'super_admin', is_active: true, organization_id: state.orgB,
  })
  if (profBErr) throw new Error(`setup — crear perfil B: ${profBErr.message}`)

  // Datos "reales" en la organización A, insertados directo con service_role
  // (bypassea RLS a propósito — esto simula datos ya existentes, no es parte del test).
  const company = must('crear empresa A', await admin.from('companies')
    .insert({ name: `Empresa Secreta A ${stamp}`, organization_id: state.orgA })
    .select('id').single())
  const contact = must('crear contacto A', await admin.from('contacts')
    .insert({ company_id: company.id, full_name: 'Contacto Secreto A', organization_id: state.orgA })
    .select('id').single())
  const deal = must('crear deal A', await admin.from('deals')
    .insert({ company_id: company.id, primary_contact_id: contact.id, owner_id: state.userA.id,
      stage: 'nuevo_lead', status: 'open', organization_id: state.orgA })
    .select('id').single())
  const { error: taskErr } = await admin.from('tasks')
    .insert({ title: `Tarea secreta A ${stamp}`, organization_id: state.orgA, created_by: state.userA.id })
  if (taskErr) throw new Error(`setup — crear tarea A: ${taskErr.message}`)

  state.companyId = company.id
  state.dealId = deal.id
}

async function loginAs(user) {
  const client = createClient(URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw new Error(`No se pudo loguear como ${user.email}: ${error.message}`)
  return client
}

async function runTests() {
  const clientB = await loginAs(state.userB)

  const { data: companies } = await clientB.from('companies').select('id').eq('organization_id', state.orgA)
  assert('Usuario B no ve companies de la org A', (companies?.length ?? 0) === 0, `filas devueltas: ${companies?.length ?? 0}`)

  const { data: contacts } = await clientB.from('contacts').select('id').eq('organization_id', state.orgA)
  assert('Usuario B no ve contacts de la org A', (contacts?.length ?? 0) === 0, `filas devueltas: ${contacts?.length ?? 0}`)

  const { data: deals } = await clientB.from('deals').select('id').eq('organization_id', state.orgA)
  assert('Usuario B no ve deals de la org A', (deals?.length ?? 0) === 0, `filas devueltas: ${deals?.length ?? 0}`)

  const { data: tasks } = await clientB.from('tasks').select('id').eq('organization_id', state.orgA)
  assert('Usuario B no ve tasks de la org A', (tasks?.length ?? 0) === 0, `filas devueltas: ${tasks?.length ?? 0}`)

  // Sin filtro explícito por organización — cualquier fuga por política huérfana aparecería igual aquí.
  const { data: allCompaniesVisible } = await clientB.from('companies').select('id, organization_id')
  const leaked = (allCompaniesVisible ?? []).filter(c => c.organization_id === state.orgA)
  assert('Ningún company de la org A aparece en un SELECT sin filtro', leaked.length === 0, `filas filtradas: ${leaked.length}`)

  // Intento de falsificar organization_id en un INSERT. Antes de la migración
  // 026, companies_insert/contacts_insert/deals_insert solo exigían
  // `auth.uid() is not null` — sin fix, esto insertaba en la org A de verdad.
  // Ahora el trigger fuerza siempre la organización de la sesión: el check
  // es estricto, no "rechazado o corregido".
  const { data: spoofed, error: spoofErr } = await clientB.from('companies')
    .insert({ name: `Spoof ${stamp}`, organization_id: state.orgA })
    .select('id, organization_id')
    .single()
  if (spoofErr) {
    assert('INSERT falsificando organization_id de la org A es rechazado', true, spoofErr.message)
  } else {
    assert('INSERT falsificando organization_id queda forzado a la org de la sesión (B), no a la declarada (A)',
      spoofed.organization_id === state.orgB,
      `quedó con organization_id=${spoofed.organization_id}, esperaba ${state.orgB}`)
    await admin.from('companies').delete().eq('id', spoofed.id)
  }

  // Mismo ataque directo sobre `deals` — la tabla más sensible del sistema
  // (pipeline comercial completo) y la que tenía el mismo hueco.
  const { data: spoofedDeal, error: spoofDealErr } = await clientB.from('deals')
    .insert({ organization_id: state.orgA, owner_id: state.userB.id, status: 'open' })
    .select('id, organization_id')
    .single()
  if (spoofDealErr) {
    assert('INSERT de deal falsificando organization_id de la org A es rechazado', true, spoofDealErr.message)
  } else {
    assert('INSERT de deal falsificando organization_id queda forzado a la org de la sesión (B)',
      spoofedDeal.organization_id === state.orgB,
      `quedó con organization_id=${spoofedDeal.organization_id}, esperaba ${state.orgB}`)
    await admin.from('deals').delete().eq('id', spoofedDeal.id)
  }

  // canSeeDeal / whatsapp / propuestas dependen de esto — deal de otra org debe ser invisible.
  const { data: dealDetail } = await clientB.from('deals').select('id').eq('id', state.dealId).maybeSingle()
  assert('Usuario B no puede leer el deal puntual de la org A por ID', dealDetail === null)

  await testConfigIsolation(clientB)
  await testBusinessDataIsolation(clientB)
  await testPipelineInvariants()
}

// ── Datos de negocio: UPDATE/DELETE cross-tenant directo sobre deals,
//    y aislamiento de las tablas agregadas en las últimas fases
//    (whatsapp_templates, automation_rules/logs, notifications,
//    deliverables/notes) ─────────────────────────────────────────
async function testBusinessDataIsolation(clientB) {
  // UPDATE cross-tenant directo sobre deals (no solo pipeline_stages)
  const { data: updDeal } = await clientB.from('deals')
    .update({ next_action: 'HACKEADO' }).eq('id', state.dealId).select('id')
  assert('Usuario B no puede MODIFICAR el deal de la org A', (updDeal?.length ?? 0) === 0)

  const { data: checkDeal } = await admin.from('deals').select('next_action').eq('id', state.dealId).single()
  assert('El deal de la org A conserva su next_action', checkDeal.next_action !== 'HACKEADO', `next_action = ${checkDeal.next_action}`)

  // DELETE cross-tenant directo sobre deals
  const { data: delDeal } = await clientB.from('deals').delete().eq('id', state.dealId).select('id')
  assert('Usuario B no puede BORRAR (hard delete) el deal de la org A', (delDeal?.length ?? 0) === 0)

  // soft_delete_deal cross-tenant — la función valida organization_id =
  // current_org_id() antes de tocar nada (ver migración 020).
  const { error: softDelErr } = await clientB.rpc('soft_delete_deal', { p_deal_id: state.dealId })
  assert('soft_delete_deal sobre un deal de otra organización es rechazado', !!softDelErr, softDelErr?.message ?? 'no dio error')

  const { data: stillAlive } = await admin.from('deals').select('deleted_at').eq('id', state.dealId).single()
  assert('El deal de la org A no quedó soft-eliminado por el intento cross-tenant', stillAlive.deleted_at === null)

  // Tablas agregadas en fases posteriores — lectura cross-tenant
  const NEW_TABLES = ['whatsapp_templates', 'automation_rules', 'automation_logs', 'notes', 'deliverables']
  for (const t of NEW_TABLES) {
    const { data, error } = await clientB.from(t).select('id').eq('organization_id', state.orgA)
    if (error) {
      // notes/deliverables no tienen policies (deny-all) — un error de
      // "permission denied" o 0 filas son ambos resultados seguros.
      assert(`Usuario B no LEE ${t} de la org A (denegado explícitamente)`, true, error.message)
    } else {
      assert(`Usuario B no LEE ${t} de la org A`, (data?.length ?? 0) === 0, `filas: ${data?.length ?? 0}`)
    }
  }

  // notifications: aislamiento por usuario, no por organización directamente
  // — igual de crítico, un mensaje de otro usuario no debe filtrarse.
  const { data: notifA } = await admin.from('notifications')
    .insert({ user_id: state.userA.id, type: 'automation', title: `Secreto A ${stamp}`, body: 'x' })
    .select('id').single()
  const { data: notifSeen } = await clientB.from('notifications').select('id').eq('id', notifA.id)
  assert('Usuario B no ve una notificación dirigida al usuario A', (notifSeen?.length ?? 0) === 0)
  await admin.from('notifications').delete().eq('id', notifA.id)

  // whatsapp_templates: INSERT cross-tenant (spoofing) — incluida por
  // completitud aunque su policy ya valida organization_id=current_org_id()
  // en el WITH CHECK (a diferencia del bug de companies/contacts/deals).
  const { error: waSpoofErr } = await clientB.from('whatsapp_templates')
    .insert({ organization_id: state.orgA, name: `Spoof ${stamp}`, content: 'x' })
  assert('Usuario B no puede crear una plantilla de WhatsApp en la org A', !!waSpoofErr, waSpoofErr?.message ?? 'no dio error')
}

// ── Configuración por organización (pipeline_stages, field_definitions,
//    organization_modules) ──────────────────────────────────────────
//
// El riesgo grave en multi-tenant no es solo "puedo VER la config de otro
// cliente", sino "puedo MODIFICARLA sin querer". Las políticas de escritura
// son un camino de código distinto al de lectura: pasar el test de lectura
// no dice absolutamente nada sobre el de escritura. Se prueban por separado.
async function testConfigIsolation(clientB) {
  const CONFIG_TABLES = ['pipeline_stages', 'field_definitions', 'organization_modules']

  // Lectura
  for (const t of CONFIG_TABLES) {
    const { data } = await clientB.from(t).select('id').eq('organization_id', state.orgA)
    assert(`Usuario B no LEE ${t} de la org A`, (data?.length ?? 0) === 0, `filas: ${data?.length ?? 0}`)
  }

  const { data: stageA } = await admin.from('pipeline_stages')
    .select('id, key').eq('organization_id', state.orgA).eq('key', 'negociacion').single()

  // UPDATE cross-tenant
  const { data: upd } = await clientB.from('pipeline_stages')
    .update({ label: 'HACKEADO' }).eq('id', stageA.id).select('id')
  assert('Usuario B no puede MODIFICAR una etapa de la org A', (upd?.length ?? 0) === 0)

  const { data: check } = await admin.from('pipeline_stages').select('label').eq('id', stageA.id).single()
  assert('La etapa de la org A conserva su label', check.label !== 'HACKEADO', `label = ${check.label}`)

  // DELETE cross-tenant
  const { data: del } = await clientB.from('pipeline_stages').delete().eq('id', stageA.id).select('id')
  assert('Usuario B no puede BORRAR una etapa de la org A', (del?.length ?? 0) === 0)

  const { count } = await admin.from('pipeline_stages')
    .select('id', { count: 'exact', head: true }).eq('id', stageA.id)
  assert('La etapa de la org A sigue existiendo', count === 1)

  // INSERT cross-tenant
  const { error: insErr } = await clientB.from('pipeline_stages').insert({
    organization_id: state.orgA, key: `hack_${stamp}`, label: 'Hack', sort_order: 99,
  })
  assert('Usuario B no puede INSERTAR una etapa en la org A', !!insErr, insErr?.message ?? 'no dio error')

  // Un usuario común tampoco configura SU PROPIA organización:
  // por diseño, solo el dueño de la plataforma.
  const { error: ownErr } = await clientB.from('pipeline_stages').insert({
    organization_id: state.orgB, key: `own_${stamp}`, label: 'Propia', sort_order: 99,
  })
  assert('Un super_admin cliente no configura ni su propio embudo', !!ownErr, ownErr?.message ?? 'no dio error')
}

// ── Invariantes garantizadas por la base ──────────────────────────
async function testPipelineInvariants() {
  const { data: stages } = await admin.from('pipeline_stages')
    .select('id, key, is_default, is_won').eq('organization_id', state.orgA)

  const def = stages.find(s => s.is_default)
  const won = stages.find(s => s.is_won)
  const other = stages.find(s => !s.is_default && !s.is_won)

  assert('La organización tiene exactamente una etapa por defecto',
    stages.filter(s => s.is_default).length === 1)
  assert('La organización tiene exactamente una etapa de ganado',
    stages.filter(s => s.is_won).length === 1)

  // Regresión: la primera versión de set_default_stage hacía un solo
  // UPDATE multi-fila (`is_default = (id = target)`), y Postgres no
  // garantiza el orden de procesamiento de filas dentro de una sentencia
  // — podía violar el índice único parcial a mitad de camino aunque el
  // resultado final fuera válido. El fix (016_fix_stage_default_swap.sql)
  // usa dos UPDATE secuenciales. Se prueba el patrón directo (admin
  // bypasea RLS, así que esto no depende de is_platform_owner) ida y
  // vuelta A->B->A para no dejar el default cambiado al terminar el test.
  const { error: swap1Err } = await admin.from('pipeline_stages').update({ is_default: false }).eq('organization_id', state.orgA).eq('is_default', true)
  const { error: swap1bErr } = swap1Err ? {} : await admin.from('pipeline_stages').update({ is_default: true }).eq('id', other.id)
  assert('El patrón de dos UPDATE no viola el índice único al mover el default (ida)', !swap1Err && !swap1bErr, (swap1Err ?? swap1bErr)?.message)

  const { error: swap2Err } = await admin.from('pipeline_stages').update({ is_default: false }).eq('organization_id', state.orgA).eq('is_default', true)
  const { error: swap2bErr } = swap2Err ? {} : await admin.from('pipeline_stages').update({ is_default: true }).eq('id', def.id)
  assert('El patrón de dos UPDATE no viola el índice único al mover el default (vuelta)', !swap2Err && !swap2bErr, (swap2Err ?? swap2bErr)?.message)

  // key inmutable
  const { error: keyErr } = await admin.from('pipeline_stages')
    .update({ key: 'clave_nueva' }).eq('id', other.id)
  assert('Cambiar la key de una etapa es rechazado', !!keyErr, keyErr?.message ?? 'no dio error')

  // No desactivar la etapa por defecto ni la de ganado
  const { error: defErr } = await admin.from('pipeline_stages')
    .update({ is_active: false }).eq('id', def.id)
  assert('Desactivar la etapa por defecto es rechazado', !!defErr, defErr?.message ?? 'no dio error')

  const { error: wonErr } = await admin.from('pipeline_stages')
    .update({ is_active: false }).eq('id', won.id)
  assert('Desactivar la etapa de ganado es rechazado', !!wonErr, wonErr?.message ?? 'no dio error')

  // Segunda etapa marcada como default / ganado
  const { error: dupDefErr } = await admin.from('pipeline_stages')
    .update({ is_default: true }).eq('id', other.id)
  assert('Una segunda etapa por defecto es rechazada', !!dupDefErr, dupDefErr?.message ?? 'no dio error')

  // is_won y is_lost mutuamente excluyentes
  const { error: xorErr } = await admin.from('pipeline_stages')
    .update({ is_won: true, is_lost: true, is_terminal: true }).eq('id', other.id)
  assert('Marcar una etapa como ganada Y perdida es rechazado', !!xorErr, xorErr?.message ?? 'no dio error')

  // FK compuesta: un deal no puede apuntar a una etapa que no exista en SU
  // organización. (Las dos orgs de prueba comparten las claves sembradas por
  // defecto, así que se usa una clave inventada para aislar la garantía.)
  const { error: fkErr } = await admin.from('deals').insert({
    organization_id: state.orgA, stage: `inexistente_${stamp}`, status: 'open', owner_id: state.userA.id,
  })
  assert('Un deal con una etapa inexistente en su organización es rechazado',
    !!fkErr, fkErr?.message ?? 'no dio error')

  // El trigger asigna la etapa por defecto DE SU PROPIA organización
  const { data: autoDeal, error: autoErr } = await admin.from('deals')
    .insert({ organization_id: state.orgB, status: 'open', owner_id: state.userB.id })
    .select('id, stage').single()
  if (autoErr) {
    assert('Un deal sin stage recibe la etapa por defecto de su organización', false, autoErr.message)
  } else {
    const { data: defB } = await admin.from('pipeline_stages')
      .select('key').eq('organization_id', state.orgB).eq('is_default', true).single()
    assert('Un deal sin stage recibe la etapa por defecto de su organización',
      autoDeal.stage === defB.key, `quedó en "${autoDeal.stage}", esperaba "${defB.key}"`)
    await admin.from('deals').delete().eq('id', autoDeal.id)
  }
}

async function cleanup() {
  try {
    if (state.userA) await admin.auth.admin.deleteUser(state.userA.id)
    if (state.userB) await admin.auth.admin.deleteUser(state.userB.id)
    if (state.orgA) await admin.from('organizations').delete().eq('id', state.orgA)
    if (state.orgB) await admin.from('organizations').delete().eq('id', state.orgB)
  } catch (e) {
    console.error('Aviso: falló la limpieza automática, revisar manualmente organizaciones TEST-A/TEST-B-' + stamp, e.message)
  }
}

async function main() {
  try {
    await setup()
    await runTests()
  } catch (e) {
    console.error('Error inesperado durante el test:', e)
    results.push({ name: 'ejecución sin errores', pass: false, detail: e.message })
  } finally {
    await cleanup()
  }

  const failed = results.filter(r => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
  if (failed.length > 0) {
    console.log('\nFALLARON:')
    failed.forEach(f => console.log(`  - ${f.name} (${f.detail})`))
    process.exit(1)
  }
}

main()
