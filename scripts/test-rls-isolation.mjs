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

async function setup() {
  const { data: orgA } = await admin.from('organizations').insert({ name: `TEST-A-${stamp}` }).select('id').single()
  const { data: orgB } = await admin.from('organizations').insert({ name: `TEST-B-${stamp}` }).select('id').single()
  state.orgA = orgA.id
  state.orgB = orgB.id

  const pass = 'TestRLS!2026xk'

  const { data: authA } = await admin.auth.admin.createUser({
    email: `rls-test-a-${stamp}@example.invalid`, password: pass, email_confirm: true,
  })
  const { data: authB } = await admin.auth.admin.createUser({
    email: `rls-test-b-${stamp}@example.invalid`, password: pass, email_confirm: true,
  })
  state.userA = { id: authA.user.id, email: authA.user.email, password: pass }
  state.userB = { id: authB.user.id, email: authB.user.email, password: pass }

  await admin.from('profiles').insert({
    id: state.userA.id, full_name: 'RLS Test A', email: state.userA.email,
    role: 'super_admin', is_active: true, organization_id: state.orgA,
  })
  await admin.from('profiles').insert({
    id: state.userB.id, full_name: 'RLS Test B', email: state.userB.email,
    role: 'super_admin', is_active: true, organization_id: state.orgB,
  })

  // Datos "reales" en la organización A, insertados directo con service_role
  // (bypassea RLS a propósito — esto simula datos ya existentes, no es parte del test).
  const { data: company } = await admin.from('companies')
    .insert({ name: `Empresa Secreta A ${stamp}`, organization_id: state.orgA })
    .select('id').single()
  const { data: contact } = await admin.from('contacts')
    .insert({ company_id: company.id, full_name: 'Contacto Secreto A', organization_id: state.orgA })
    .select('id').single()
  const { data: deal } = await admin.from('deals')
    .insert({ company_id: company.id, primary_contact_id: contact.id, owner_id: state.userA.id,
      stage: 'nuevo_lead', status: 'open', organization_id: state.orgA })
    .select('id').single()
  await admin.from('tasks')
    .insert({ title: `Tarea secreta A ${stamp}`, organization_id: state.orgA, created_by: state.userA.id })

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

  // Intento de falsificar organization_id en un INSERT (verifica el fix de los triggers).
  const { data: spoofed, error: spoofErr } = await clientB.from('companies')
    .insert({ name: `Spoof ${stamp}`, organization_id: state.orgA })
    .select('id, organization_id')
    .single()
  if (spoofErr) {
    assert('INSERT falsificando organization_id de la org A es rechazado', true, spoofErr.message)
  } else {
    assert('INSERT falsificando organization_id de la org A es rechazado o corregido',
      spoofed.organization_id !== state.orgA,
      `quedó con organization_id=${spoofed.organization_id}`)
    await admin.from('companies').delete().eq('id', spoofed.id)
  }

  // canSeeDeal / whatsapp / propuestas dependen de esto — deal de otra org debe ser invisible.
  const { data: dealDetail } = await clientB.from('deals').select('id').eq('id', state.dealId).maybeSingle()
  assert('Usuario B no puede leer el deal puntual de la org A por ID', dealDetail === null)
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
