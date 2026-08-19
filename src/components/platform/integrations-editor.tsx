'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react'

interface Integration {
  id: string
  provider: 'meta_leads' | 'whatsapp' | 'webhook_form' | 'google_workspace' | 'microsoft_365'
  external_id: string
  access_token: string | null
  label: string | null
  is_active: boolean
  config?: { pubsub_topic?: string } | null
}

const PROVIDER_LABELS: Record<Integration['provider'], string> = {
  meta_leads: 'Meta Lead Ads',
  whatsapp: 'WhatsApp Business',
  webhook_form: 'Formulario web propio',
  google_workspace: 'Gmail / Google Workspace',
  microsoft_365: 'Outlook / Microsoft 365',
}

const PROVIDER_HELP: Record<Integration['provider'], string> = {
  meta_leads: 'ID de la página de Facebook (Page ID) y, opcional, un Page Access Token propio de esta organización — si se deja vacío, se usa el global.',
  whatsapp: 'Phone Number ID de WhatsApp Cloud API y su Access Token — si se dejan vacíos, se usa el número global de la instalación.',
  webhook_form: 'Se generan solos: un identificador interno y un token secreto que el formulario del cliente manda como Authorization: Bearer.',
  google_workspace: 'App OAuth interna del Google Cloud del CLIENTE (Client ID / Client Secret) + el tema de Pub/Sub para recibir correo nuevo — evita la auditoría CASA que exige Google para una app propia con scopes de Gmail.',
  microsoft_365: 'App OAuth registrada en el Entra ID del cliente (Client ID / Client Secret). No necesita infraestructura extra, a diferencia de Gmail.',
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-1.5 py-0.5 rounded-md transition-colors">
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function TokenCell({ value }: { value: string | null }) {
  const [show, setShow] = useState(false)
  if (!value) return <span className="text-slate-300">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{show ? value : '•'.repeat(Math.min(value.length, 20))}</span>
      <button type="button" onClick={() => setShow(v => !v)} className="text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <CopyField value={value} />
    </span>
  )
}

export default function IntegrationsEditor({ orgId, integrations }: { orgId: string; integrations: Integration[] }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [provider, setProvider] = useState<Integration['provider']>('meta_leads')
  const [label, setLabel] = useState('')
  const [externalId, setExternalId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [pubsubTopic, setPubsubTopic] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy('new')
    setError('')
    try {
      const config = provider === 'google_workspace' ? { pubsub_topic: pubsubTopic } : undefined
      const res = await fetch('/api/platform/integrations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, provider, label, externalId, accessToken, config }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setShowNew(false); setLabel(''); setExternalId(''); setAccessToken(''); setPubsubTopic('')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch('/api/platform/integrations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta integración? Los leads/mensajes de esa página o número dejarán de asignarse a esta organización.')) return
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/platform/integrations?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Integraciones</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Meta Lead Ads, WhatsApp Business y formularios propios — sin esto, un lead/mensaje de una organización sin integración configurada cae en la organización global de respaldo.</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
          <Plus className="w-3.5 h-3.5" /> Nueva
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showNew && (
        <form onSubmit={create} className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tipo</label>
            <select value={provider} onChange={e => setProvider(e.target.value as Integration['provider'])}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full bg-white">
              {(Object.keys(PROVIDER_LABELS) as Integration['provider'][]).map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">{PROVIDER_HELP[provider]}</p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nombre (opcional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ej. Página de Facebook principal"
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full" />
          </div>
          {provider !== 'webhook_form' && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  {provider === 'meta_leads' ? 'Page ID'
                    : provider === 'whatsapp' ? 'Phone Number ID'
                    : 'Client ID'}
                </label>
                <input value={externalId} onChange={e => setExternalId(e.target.value)} required
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  {provider === 'google_workspace' || provider === 'microsoft_365'
                    ? 'Client secret'
                    : 'Access token (opcional — si se deja vacío, usa el global)'}
                </label>
                <input value={accessToken} onChange={e => setAccessToken(e.target.value)} type="password"
                  required={provider === 'google_workspace' || provider === 'microsoft_365'}
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full font-mono" />
              </div>
              {provider === 'google_workspace' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tema de Pub/Sub (projects/…/topics/…)</label>
                  <input value={pubsubTopic} onChange={e => setPubsubTopic(e.target.value)} required
                    placeholder="projects/mi-proyecto/topics/gmail-push"
                    className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-full font-mono" />
                </div>
              )}
            </>
          )}
          <button type="submit" disabled={busy === 'new'}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-50">
            Crear
          </button>
        </form>
      )}

      {integrations.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Sin integraciones — esta organización depende de las variables de entorno globales.</p>
      ) : (
        <div className="space-y-2">
          {integrations.map(i => (
            <div key={i.id} className={`p-3 rounded-xl border ${i.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{PROVIDER_LABELS[i.provider]}{i.label ? ` — ${i.label}` : ''}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {i.provider === 'webhook_form' ? 'URL'
                      : i.provider === 'meta_leads' ? 'Page ID'
                      : i.provider === 'whatsapp' ? 'Phone Number ID'
                      : 'Client ID'}:{' '}
                    <span className="font-mono">{i.provider === 'webhook_form' ? '/api/webhooks/lead' : i.external_id}</span>
                    {i.provider === 'webhook_form' && <CopyField value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/lead`} />}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {i.provider === 'webhook_form' ? 'Token (Authorization: Bearer)'
                      : i.provider === 'google_workspace' || i.provider === 'microsoft_365' ? 'Client secret'
                      : 'Access token'}: <TokenCell value={i.access_token} />
                  </p>
                  {i.provider === 'google_workspace' && i.config?.pubsub_topic && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Tema Pub/Sub: <span className="font-mono">{i.config.pubsub_topic}</span></p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={i.is_active} disabled={busy === i.id}
                      onChange={e => toggle(i.id, e.target.checked)} className="sr-only peer" />
                    <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3.5" />
                  </label>
                  <button onClick={() => remove(i.id)} disabled={busy === i.id}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
