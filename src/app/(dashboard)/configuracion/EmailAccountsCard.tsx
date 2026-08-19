'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, CheckCircle2, AlertCircle, Trash2, Loader2 } from 'lucide-react'

interface EmailAccount {
  id: string
  provider: 'google_workspace' | 'microsoft_365'
  email_address: string
  is_active: boolean
}

const PROVIDER_LABEL: Record<EmailAccount['provider'], string> = {
  google_workspace: 'Gmail / Google Workspace',
  microsoft_365: 'Outlook / Microsoft 365',
}

export default function EmailAccountsCard({
  accounts: initialAccounts, connectedMessage, errorMessage,
}: {
  accounts: EmailAccount[]
  connectedMessage?: string
  errorMessage?: string
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()

  async function disconnect(id: string) {
    if (!confirm('¿Desconectar esta casilla? Dejarás de recibir y enviar correos desde el CRM con esta cuenta.')) return
    setBusy(id)
    await fetch(`/api/email/accounts/${id}`, { method: 'DELETE' })
    setAccounts(prev => prev.filter(a => a.id !== id))
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Mail className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Correo conectado</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        {connectedMessage && (
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800">Conectado: {connectedMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">{errorMessage}</p>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-xs text-slate-500">Conectá tu casilla para ver y responder correos directo desde cada deal.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{a.email_address}</p>
                  <p className="text-[10px] text-slate-400">{PROVIDER_LABEL[a.provider]}</p>
                </div>
                <button onClick={() => disconnect(a.id)} disabled={busy === a.id}
                  className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                  {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <a href="/api/email/connect/google"
            className="flex-1 text-center text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            Conectar Gmail
          </a>
          <a href="/api/email/connect/microsoft"
            className="flex-1 text-center text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            Conectar Outlook
          </a>
        </div>
      </div>
    </div>
  )
}
