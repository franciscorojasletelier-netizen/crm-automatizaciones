// Tests del módulo de Cobranza (migración 038) contra la base real.
//
// Crea 2 organizaciones con usuarios de prueba (gerente A, comercial A,
// gerente B), ejercita las reglas que garantiza la BASE — no la UI — y
// borra todo al final, incluso si algo falla:
//   - correlativo por organización y organización forzada a la sesión
//   - saldo/estado derivados de los pagos (no editables desde la app)
//   - pago que supera el saldo, anular con pagos, reactivar anulado
//   - compromisos de pago → next_promise_date
//   - visibilidad: gerente ve todo, comercial solo lo de sus deals,
//     otra organización nada; comercial no registra pagos
//
// Uso: npm run test:cobranza  (lee .env.local)

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Faltan env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const stamp = Date.now()
const PASS = `Cobranza!${stamp}x`
const state = { orgs: [], users: [] }
const results = []
function assert(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`)
}
function must(label, { data, error }) {
  if (error || !data) throw new Error(`setup — ${label}: ${error?.message ?? '(sin datos)'}`)
  return data
}

async function makeOrg(tag) {
  const org = must(`org ${tag}`, await admin.from('organizations').insert({ name: `TEST-COB-${tag}-${stamp}` }).select('id').single())
  state.orgs.push(org.id)
  const { error } = await admin.rpc('seed_default_stages', { p_org_id: org.id })
  if (error) throw new Error(`setup — etapas ${tag}: ${error.message}`)
  return org.id
}

async function makeUser(tag, orgId, role) {
  const email = `cob-test-${tag}-${stamp}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  if (error) throw new Error(`setup — usuario ${tag}: ${error.message}`)
  state.users.push(data.user.id)
  const { error: pErr } = await admin.from('profiles').insert({
    id: data.user.id, full_name: `Cobranza ${tag}`, email, role, is_active: true, organization_id: orgId,
  })
  if (pErr) throw new Error(`setup — perfil ${tag}: ${pErr.message}`)
  const client = createClient(URL, ANON_KEY, { auth: { persistSession: false } })
  const { error: lErr } = await client.auth.signInWithPassword({ email, password: PASS })
  if (lErr) throw new Error(`login ${tag}: ${lErr.message}`)
  return { id: data.user.id, client }
}

async function main() {
  const orgA = await makeOrg('A')
  const orgB = await makeOrg('B')
  const gerenteA = await makeUser('gA', orgA, 'gerente')
  const comercialA = await makeUser('cA', orgA, 'comercial')
  const gerenteB = await makeUser('gB', orgB, 'gerente')
  const finanzasA = await makeUser('fA', orgA, 'finanzas')
  const finanzasB = await makeUser('fB', orgB, 'finanzas')

  const company = must('empresa', await admin.from('companies').insert({ name: `Cliente Cobranza ${stamp}`, organization_id: orgA }).select('id').single())
  // Un deal del comercial y otro de gerencia
  const dealC = must('deal comercial', await admin.from('deals').insert({ company_id: company.id, owner_id: comercialA.id, status: 'open', organization_id: orgA }).select('id').single())
  const dealG = must('deal gerente', await admin.from('deals').insert({ company_id: company.id, owner_id: gerenteA.id, status: 'open', organization_id: orgA }).select('id').single())

  const g = gerenteA.client
  const base = { company_id: company.id, description: 'Implementación', due_date: '2026-10-15', issue_date: '2026-09-30' }

  // ── Creación ──
  const { data: inv1, error: e1 } = await g.from('invoices')
    .insert({ ...base, amount: 1_000_000, deal_id: dealC.id, organization_id: orgB, paid_amount: 999, status: 'pagada' })
    .select('id, organization_id, invoice_number, paid_amount, status').single()
  assert('Gerente crea un documento', !e1 && inv1, e1?.message)
  assert('La organización se fuerza a la de la sesión (ignora la enviada)', inv1?.organization_id === orgA)
  assert('Un documento nuevo parte en 0 pagado y "pendiente" aunque se envíe otra cosa', inv1?.paid_amount === 0 && inv1?.status === 'pendiente', JSON.stringify(inv1))

  const { data: inv2 } = await g.from('invoices').insert({ ...base, amount: 500_000, deal_id: dealG.id }).select('id, invoice_number').single()
  assert('Correlativo por organización', inv2?.invoice_number === (inv1?.invoice_number ?? 0) + 1, `${inv1?.invoice_number} → ${inv2?.invoice_number}`)

  const { error: eDates } = await g.from('invoices').insert({ ...base, amount: 1, due_date: '2026-01-01' })
  assert('Vencimiento anterior a la emisión es rechazado', !!eDates, eDates?.message)

  const { error: eCom } = await comercialA.client.from('invoices').insert({ ...base, amount: 1000 })
  assert('Un comercial NO crea documentos', !!eCom, eCom?.message)

  // ── Pagos y estado derivado ──
  const { error: pOver } = await g.from('invoice_payments').insert({ invoice_id: inv1.id, amount: 1_000_001 })
  assert('Pago mayor al saldo es rechazado', !!pOver, pOver?.message)

  const { data: pay1, error: pErr } = await g.from('invoice_payments').insert({ invoice_id: inv1.id, amount: 400_000, method: 'transferencia' }).select('id, organization_id').single()
  assert('Gerente registra un abono', !pErr && pay1, pErr?.message)
  let { data: after1 } = await g.from('invoices').select('paid_amount, status').eq('id', inv1.id).single()
  assert('Abono parcial → estado "parcial" y saldo actualizado', after1?.status === 'parcial' && Number(after1?.paid_amount) === 400_000, JSON.stringify(after1))

  const { error: pCom } = await comercialA.client.from('invoice_payments').insert({ invoice_id: inv1.id, amount: 1000 })
  assert('Un comercial NO registra pagos', !!pCom, pCom?.message)

  await g.from('invoices').update({ paid_amount: 1_000_000, status: 'pagada' }).eq('id', inv1.id)
  ;({ data: after1 } = await g.from('invoices').select('paid_amount, status').eq('id', inv1.id).single())
  assert('Saldo y estado no se pueden forzar desde la app', after1?.status === 'parcial' && Number(after1?.paid_amount) === 400_000, JSON.stringify(after1))

  const { error: cancelErr } = await g.from('invoices').update({ status: 'anulada', cancelled_reason: 'x' }).eq('id', inv1.id)
  assert('No se anula un documento con pagos', !!cancelErr, cancelErr?.message)

  await g.from('invoice_payments').insert({ invoice_id: inv1.id, amount: 600_000, method: 'cheque' })
  ;({ data: after1 } = await g.from('invoices').select('paid_amount, status').eq('id', inv1.id).single())
  assert('Pago del saldo → "pagada"', after1?.status === 'pagada', JSON.stringify(after1))

  await g.from('invoice_payments').delete().eq('id', pay1.id)
  ;({ data: after1 } = await g.from('invoices').select('paid_amount, status').eq('id', inv1.id).single())
  assert('Eliminar un pago recalcula saldo y estado', after1?.status === 'parcial' && Number(after1?.paid_amount) === 600_000, JSON.stringify(after1))

  const { error: lowerErr } = await g.from('invoices').update({ amount: 100 }).eq('id', inv1.id)
  assert('El monto no puede quedar bajo lo pagado', !!lowerErr, lowerErr?.message)

  // ── Anular ──
  const { error: anErr } = await g.from('invoices').update({ status: 'anulada', cancelled_reason: 'Duplicado' }).eq('id', inv2.id)
  const { data: anulada } = await g.from('invoices').select('status, cancelled_at').eq('id', inv2.id).single()
  assert('Anular un documento sin pagos', !anErr && anulada?.status === 'anulada' && !!anulada?.cancelled_at, anErr?.message)
  const { error: reErr } = await g.from('invoices').update({ status: 'pendiente' }).eq('id', inv2.id)
  assert('Un anulado no se reactiva', !!reErr, reErr?.message)
  const { error: payAn } = await g.from('invoice_payments').insert({ invoice_id: inv2.id, amount: 1 })
  assert('No se paga un documento anulado', !!payAn, payAn?.message)

  // ── Gestiones ──
  const { error: actErr } = await comercialA.client.from('invoice_activities')
    .insert({ invoice_id: inv1.id, kind: 'compromiso', notes: 'Pagará el saldo', promise_date: '2026-10-20', promise_amount: 400_000 })
  assert('El comercial del deal registra una gestión', !actErr, actErr?.message)
  const { data: withPromise } = await g.from('invoices').select('next_promise_date, last_activity_at').eq('id', inv1.id).single()
  assert('Compromiso de pago actualiza la próxima fecha', withPromise?.next_promise_date === '2026-10-20' && !!withPromise?.last_activity_at, JSON.stringify(withPromise))
  const { error: noDate } = await g.from('invoice_activities').insert({ invoice_id: inv1.id, kind: 'compromiso', notes: 'sin fecha' })
  assert('Un compromiso sin fecha es rechazado', !!noDate, noDate?.message)

  // ── Visibilidad ──
  const { data: seenByCom } = await comercialA.client.from('invoices').select('id')
  const ids = (seenByCom ?? []).map(r => r.id)
  assert('El comercial ve el documento de SU deal', ids.includes(inv1.id))
  assert('El comercial NO ve el documento de un deal ajeno', !ids.includes(inv2.id))
  const { data: seenByB } = await gerenteB.client.from('invoices').select('id')
  assert('Otra organización no ve ningún documento', (seenByB ?? []).length === 0, `filas: ${seenByB?.length}`)
  const { data: paysB } = await gerenteB.client.from('invoice_payments').select('id')
  assert('Otra organización no ve pagos', (paysB ?? []).length === 0)
  const { error: bPay } = await gerenteB.client.from('invoice_payments').insert({ invoice_id: inv1.id, amount: 1 })
  assert('Otra organización no registra pagos en documentos ajenos', !!bPay, bPay?.message)
  const { data: bUpd } = await gerenteB.client.from('invoices').update({ description: 'HACK' }).eq('id', inv1.id).select('id')
  assert('Otra organización no modifica documentos ajenos', (bUpd ?? []).length === 0)
  const { error: bAct } = await gerenteB.client.from('invoice_activities').insert({ invoice_id: inv1.id, kind: 'nota', notes: 'x' })
  assert('Otra organización no registra gestiones en documentos ajenos', !!bAct, bAct?.message)

  // ── Rol Finanzas (039) ──
  const f = finanzasA.client
  const { data: fSeen } = await f.from('invoices').select('id')
  assert('Finanzas ve TODOS los documentos de su organización', (fSeen ?? []).length === 2, `filas: ${fSeen?.length}`)
  const { data: fInv, error: fInvErr } = await f.from('invoices').insert({ ...base, amount: 250_000 }).select('id').single()
  assert('Finanzas crea documentos', !fInvErr && fInv, fInvErr?.message)
  const { error: fPayErr } = await f.from('invoice_payments').insert({ invoice_id: fInv?.id, amount: 250_000 })
  assert('Finanzas registra pagos', !fPayErr, fPayErr?.message)
  const { data: fCompanies } = await f.from('companies').select('id').eq('id', company.id)
  assert('Finanzas lee las empresas de su organización', (fCompanies ?? []).length === 1)
  const { data: fDeals } = await f.from('deals').select('id')
  assert('Finanzas NO ve el pipeline comercial', (fDeals ?? []).length === 0, `filas: ${fDeals?.length}`)
  const { data: fB } = await finanzasB.client.from('companies').select('id').eq('id', company.id)
  assert('Finanzas de otra organización no lee empresas ajenas', (fB ?? []).length === 0)

  // ── Escalamiento de privilegios en profiles (040) ──
  const roleOf = async id => (await admin.from('profiles').select('role').eq('id', id).single()).data?.role
  await g.from('profiles').update({ role: 'super_admin' }).eq('id', comercialA.id)
  assert('Un gerente NO puede ascender a nadie a super_admin', (await roleOf(comercialA.id)) === 'comercial', await roleOf(comercialA.id))
  const { error: toFin } = await g.from('profiles').update({ role: 'finanzas' }).eq('id', comercialA.id)
  assert('Un gerente sí asigna roles operativos (finanzas)', !toFin && (await roleOf(comercialA.id)) === 'finanzas', toFin?.message)
  await admin.from('profiles').update({ role: 'comercial' }).eq('id', comercialA.id)
  await comercialA.client.from('profiles').update({ role: 'super_admin' }).eq('id', comercialA.id)
  assert('Nadie se sube el rol a sí mismo', (await roleOf(comercialA.id)) === 'comercial')

  // Usuario de Auth sin perfil (lo que dejaría el registro público):
  // antes podía crearse un perfil super_admin en cualquier organización.
  const orphanEmail = `cob-test-orphan-${stamp}@example.invalid`
  const { data: orphan } = await admin.auth.admin.createUser({ email: orphanEmail, password: PASS, email_confirm: true })
  state.users.push(orphan.user.id)
  const oc = createClient(URL, ANON_KEY, { auth: { persistSession: false } })
  await oc.auth.signInWithPassword({ email: orphanEmail, password: PASS })
  const { error: selfIns } = await oc.from('profiles').insert({ id: orphan.user.id, full_name: 'x', email: orphanEmail, role: 'super_admin', is_active: true, organization_id: orgA })
  assert('Un usuario sin perfil NO puede crearse un perfil super_admin', !!selfIns, selfIns?.message)

  // ── Monedas e impuestos (migraciones 050–051) ──
  const gB = gerenteB.client
  const companyB = must('empresa B', await admin.from('companies').insert({ name: `Cliente USD ${stamp}`, organization_id: orgB }).select('id').single())
  const { error: toUsd } = await gB.from('organizations').update({ currency: 'USD' }).eq('id', orgB)
  assert('Sin cobranza, la organización puede cambiar su moneda', !toUsd, toUsd?.message)
  const { data: usdInv, error: usdErr } = await gB.from('invoices')
    .insert({ company_id: companyB.id, description: 'Servicio', amount: 1234.56, currency: 'CLP', due_date: '2026-10-15', issue_date: '2026-09-30' })
    .select('id, currency, amount').single()
  assert('La factura toma la moneda de la organización (no la que envía la app)', usdInv?.currency === 'USD', usdErr?.message ?? usdInv?.currency)
  assert('Los montos USD guardan centavos', Number(usdInv?.amount) === 1234.56, String(usdInv?.amount))
  const { error: payUsd } = await gB.from('invoice_payments').insert({ invoice_id: usdInv?.id, amount: 0.56, paid_on: '2026-10-01' })
  const { data: usdAfter } = await gB.from('invoices').select('paid_amount, status').eq('id', usdInv?.id).single()
  assert('Un pago con centavos actualiza saldo y estado', !payUsd && Number(usdAfter?.paid_amount) === 0.56 && usdAfter?.status === 'parcial', payUsd?.message ?? JSON.stringify(usdAfter))
  await gB.from('invoices').update({ currency: 'EUR' }).eq('id', usdInv?.id)
  const { data: usdKept } = await gB.from('invoices').select('currency').eq('id', usdInv?.id).single()
  assert('La moneda de una factura no se puede cambiar', usdKept?.currency === 'USD', usdKept?.currency)
  const { error: toEur } = await gB.from('organizations').update({ currency: 'EUR' }).eq('id', orgB)
  assert('Con cobranza, la moneda de la organización no cambia', !!toEur, toEur?.message)

  const { data: q1, error: q1Err } = await g.from('quotes')
    .insert({ deal_id: dealG.id, items: [{ description: 'Consultoría', quantity: 1, unit_price: 100 }], taxes: [{ label: 'IVA', rate: 19 }, { label: 'Impuesto adicional', rate: 10 }], currency: 'USD' })
    .select('id, tax_rate, created_by, currency').single()
  assert('Una cotización guarda varios impuestos (tax_rate = suma)', Number(q1?.tax_rate) === 29, q1Err?.message ?? String(q1?.tax_rate))
  assert('La cotización registra a su autor automáticamente', q1?.created_by === gerenteA.id, q1?.created_by ?? 'null')
  const { error: badTax } = await g.from('quotes').insert({ deal_id: dealG.id, items: [], taxes: [{ label: 'IVA', rate: 150 }] })
  assert('Un impuesto fuera de 0–100 % es rechazado', !!badTax, badTax?.message)
  const { error: badCur } = await g.from('quotes').insert({ deal_id: dealG.id, items: [], currency: 'ARS' })
  assert('Una moneda no soportada es rechazada', !!badCur, badCur?.message)
  await g.from('quotes').update({ status: 'sent', public_token: crypto.randomUUID() }).eq('id', q1?.id)
  const { data: delSent } = await g.from('quotes').delete().eq('id', q1?.id).select('id')
  assert('Una cotización enviada no se puede eliminar', (delSent ?? []).length === 0)
  const q2 = must('cotización borrador', await g.from('quotes').insert({ deal_id: dealG.id, items: [] }).select('id').single())
  const { data: delOther } = await comercialA.client.from('quotes').delete().eq('id', q2.id).select('id')
  assert('Un comercial no elimina borradores ajenos', (delOther ?? []).length === 0)
  const { data: delDraft } = await g.from('quotes').delete().eq('id', q2.id).select('id')
  assert('Un borrador sí se puede eliminar', (delDraft ?? []).length === 1)
}

async function cleanup() {
  try {
    const orgs = state.orgs
    if (orgs.length) {
      for (const t of ['quotes', 'invoices', 'deals', 'companies']) {
        const { error } = await admin.from(t).delete().in('organization_id', orgs)
        if (error) throw new Error(`${t}: ${error.message}`)
      }
    }
    for (const id of state.users) await admin.auth.admin.deleteUser(id)
    if (orgs.length) {
      const { error } = await admin.from('organizations').delete().in('id', orgs)
      if (error) throw new Error(`organizations: ${error.message}`)
    }
  } catch (e) {
    console.error(`Aviso: falló la limpieza, revisar organizaciones TEST-COB-*-${stamp}:`, e.message)
  }
}

try {
  await main()
} catch (e) {
  console.error('Error inesperado:', e)
  results.push({ name: 'ejecución sin errores', pass: false, detail: e.message })
} finally {
  await cleanup()
}
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
if (failed.length) {
  console.log('\nFALLARON:')
  failed.forEach(f => console.log(`  - ${f.name} (${f.detail})`))
  process.exit(1)
}
