export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { canonicalJson, sha256Hex, type AcceptanceSnapshot } from '@/lib/quote-acceptance'
import { money } from '@/lib/money'
import { CHILE_TZ, DATE_ONLY_TZ } from '@/lib/dates'
import PrintButton from './print-button'

export const metadata = { title: 'Comprobante de aceptación', robots: { index: false } }

// Comprobante de aceptación de una cotización: la copia exacta guardada al
// firmar y su huella. Se verifica en cada carga (recalcula la huella).
export default async function AcceptanceCertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: q } = await supabase.from('quotes').select('status, accepted_snapshot, accepted_hash, organization_id').eq('public_token', token).maybeSingle()
  if (!q || q.status !== 'accepted' || !q.accepted_snapshot || !q.accepted_hash) notFound()
  const { data: org } = await supabase.from('organizations').select('logo_url').eq('id', q.organization_id).maybeSingle()

  const s = q.accepted_snapshot as AcceptanceSnapshot
  const intact = sha256Hex(canonicalJson(s)) === q.accepted_hash
  const cur = s.documento.moneda
  const a = s.aceptacion
  const dt = (iso: string) => new Date(iso).toLocaleString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4 print:hidden"><PrintButton /></div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 sm:p-8 print:border-none print:shadow-none">
          <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo externo de Storage */}
              {org?.logo_url && <img src={org.logo_url} alt={s.proveedor} className="h-9 max-w-[160px] object-contain mb-2" />}
              <h1 className="text-lg font-bold text-slate-900">Comprobante de aceptación</h1>
              <p className="text-xs text-slate-500">{s.proveedor} · Cotización N° {s.documento.numero}</p>
            </div>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${intact ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {intact ? 'Documento íntegro' : 'Huella no coincide'}
            </span>
          </div>

          <section className="mb-5">
            <h2 className="text-xs font-semibold text-slate-500 mb-2">Firmado por</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Nombre</dt><dd className="text-slate-900 font-medium">{a.nombre}</dd>
              <dt className="text-slate-500">RUT</dt><dd className="text-slate-900">{a.rut}</dd>
              {a.cargo && <><dt className="text-slate-500">Cargo</dt><dd className="text-slate-900">{a.cargo}</dd></>}
              {s.cliente.empresa && <><dt className="text-slate-500">Empresa</dt><dd className="text-slate-900">{s.cliente.empresa}</dd></>}
              <dt className="text-slate-500">Correo verificado</dt><dd className="text-slate-900 break-all">{a.correo_verificado}</dd>
              <dt className="text-slate-500">Fecha y hora</dt><dd className="text-slate-900">{dt(a.fecha)}</dd>
              <dt className="text-slate-500">IP</dt><dd className="text-slate-900">{a.ip}</dd>
              {a.navegador && <><dt className="text-slate-500">Navegador</dt><dd className="text-slate-600 text-xs break-all">{a.navegador}</dd></>}
            </dl>
          </section>

          <section className="mb-5 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">“{a.declaracion}”</section>

          <section className="mb-5">
            <h2 className="text-xs font-semibold text-slate-500 mb-2">Documento aceptado</h2>
            <p className="text-xs text-slate-500 mb-2">
              Emitida el {new Date(s.documento.emitida).toLocaleDateString('es-CL', { timeZone: CHILE_TZ, day: 'numeric', month: 'long', year: 'numeric' })}
              {s.documento.valida_hasta && ` · válida hasta el ${new Date(`${s.documento.valida_hasta}T00:00:00Z`).toLocaleDateString('es-CL', { timeZone: DATE_ONLY_TZ, day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
            <table className="w-full text-sm">
              <tbody>
                {s.items.map((i, k) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{i.descripcion} <span className="text-slate-400">× {i.cantidad}</span></td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">{money(i.total, cur)}</td>
                  </tr>
                ))}
                <tr><td className="pt-2 text-slate-500">Subtotal</td><td className="pt-2 text-right">{money(s.subtotal, cur)}</td></tr>
                {s.impuestos.map((t, k) => <tr key={k}><td className="text-slate-500">{t.nombre} ({t.tasa} %)</td><td className="text-right">{money(t.monto, cur)}</td></tr>)}
                <tr className="font-bold"><td className="pt-1">Total</td><td className="pt-1 text-right">{money(s.total, cur)}</td></tr>
              </tbody>
            </table>
          </section>

          {s.plan_de_pagos.length > 0 && (
            <section className="mb-5">
              <h2 className="text-xs font-semibold text-slate-500 mb-2">Plan de pagos aceptado</h2>
              <table className="w-full text-sm">
                <tbody>
                  {s.plan_de_pagos.map(c => (
                    <tr key={c.cuota} className="border-b border-slate-100">
                      <td className="py-2 text-slate-700">Cuota {c.cuota} · {c.hito}</td>
                      <td className="py-2 pl-3 text-right text-slate-500">{c.porcentaje} %</td>
                      <td className="py-2 pl-3 text-right font-medium whitespace-nowrap">{money(c.monto, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.condiciones_de_pago && <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">{s.condiciones_de_pago}</p>}
            </section>
          )}

          <section className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <p>{a.metodo}</p>
            <p className="break-all">Huella SHA-256 de la copia aceptada: <span className="font-mono text-slate-700">{q.accepted_hash}</span></p>
          </section>
        </div>
      </div>
    </div>
  )
}
