// Tabla del plan de pagos con montos (vista interna, página del cliente).
import { money } from '@/lib/money'
import { paymentSchedule, type PaymentTerm } from '@/lib/payment-terms'

export default function PaymentScheduleTable({ terms, conditions, total, currency }: {
  terms: PaymentTerm[] | null; conditions?: string | null; total: number; currency: string
}) {
  if (!terms?.length) return null
  const rows = paymentSchedule(terms, total, currency)
  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-slate-500 mb-2">Forma de pago</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 text-slate-700">Cuota {i + 1} · {r.label}</td>
              <td className="py-2 pl-3 text-right text-slate-500 whitespace-nowrap">{r.pct.toLocaleString('es-CL')} %</td>
              <td className="py-2 pl-3 text-right font-medium text-slate-800 whitespace-nowrap tabular-nums">{money(r.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {conditions && <p className="mt-2 text-xs text-slate-500 whitespace-pre-wrap">{conditions}</p>}
    </div>
  )
}
