'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Mail, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import { DEFAULT_TEMPLATES, TEMPLATE_LIMITS, normalizeTemplates, type EmailTemplate } from '@/lib/email-templates'

const newId = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// Plantillas por situación que se eligen al escribir un correo desde la
// ficha del lead. scope 'org': las de la empresa, que edita gerencia (sin
// cambios se usan las del CRM). scope 'user': las propias de cada usuario.
export default function EmailTemplatesCard({ scope = 'org', targetId, raw }: { scope?: 'org' | 'user'; targetId: string; raw: unknown }) {
  const isOrg = scope === 'org'
  const [list, setList] = useState<EmailTemplate[]>(() => normalizeTemplates(raw, isOrg ? DEFAULT_TEMPLATES : []))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  const update = (id: string, patch: Partial<EmailTemplate>) => {
    setList(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t)); setMsg(null)
  }

  async function persist(next: EmailTemplate[] | null, okText: string) {
    setBusy(true); setMsg(null)
    const { error } = await createClient().from(isOrg ? 'organizations' : 'profiles').update({ email_templates: next }).eq('id', targetId)
    setBusy(false)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: okText })
    if (!error) router.refresh()
  }

  async function save() {
    const clean = list.map(t => ({ ...t, label: t.label.trim(), subject: t.subject.trim(), body: t.body.trim() }))
    if (clean.some(t => !t.label || !t.body)) { setMsg({ ok: false, text: 'Cada plantilla necesita un nombre y un texto.' }); return }
    await persist(clean, 'Guardado. Ya aparecen al escribir un correo desde un lead.')
  }

  async function restore() {
    if (!window.confirm('¿Volver a las plantillas originales del CRM? Se pierden los cambios.')) return
    setList(DEFAULT_TEMPLATES)
    await persist(null, 'Se restauraron las plantillas originales.')
  }

  return (
    <div className="bg-card rounded-lg border border-slate-200 shadow-xs">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Mail className="w-4 h-4 text-slate-500" /> {isOrg ? 'Plantillas de correo de la empresa' : 'Mis plantillas de correo'}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isOrg
            ? 'Las ve todo el equipo como botones al escribir un correo desde un lead. '
            : 'Solo las ves tú, junto a las de la empresa. También puedes crearlas desde un correo con "Guardar como mi plantilla". '}
          Puedes usar {'{nombre}'}, {'{empresa}'}, {'{miempresa}'} y {'{vendedor}'};
          lo que pongas entre corchetes, como [plazo], el vendedor debe completarlo antes de enviar.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {list.length === 0 && <p className="text-sm text-slate-500">{isOrg ? 'Sin plantillas. Agrega una o restaura las originales.' : 'Aún no tienes plantillas propias.'}</p>}
        {list.map(t => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3 space-y-2.5">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={labelClass} htmlFor={`tpl-label-${t.id}`}>Nombre del botón</label>
                <input id={`tpl-label-${t.id}`} className={inputClass} value={t.label} maxLength={TEMPLATE_LIMITS.label}
                  onChange={e => update(t.id, { label: e.target.value })} placeholder="Seguimiento" />
              </div>
              <button type="button" onClick={() => { setList(prev => prev.filter(x => x.id !== t.id)); setMsg(null) }}
                className={cn(buttonClass.ghost, 'hover:text-red-700')} aria-label={`Quitar plantilla ${t.label}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <label className={labelClass} htmlFor={`tpl-subject-${t.id}`}>Asunto</label>
              <input id={`tpl-subject-${t.id}`} className={inputClass} value={t.subject} maxLength={TEMPLATE_LIMITS.subject}
                onChange={e => update(t.id, { subject: e.target.value })} placeholder="Seguimiento: propuesta para {empresa}" />
            </div>
            <div>
              <label className={labelClass} htmlFor={`tpl-body-${t.id}`}>Texto (va entre el saludo y la despedida)</label>
              <textarea id={`tpl-body-${t.id}`} rows={4} maxLength={TEMPLATE_LIMITS.body}
                className={cn(inputClass, 'h-auto py-2 leading-6 resize-y')} value={t.body}
                onChange={e => update(t.id, { body: e.target.value })} />
            </div>
          </div>
        ))}

        {msg && (
          <p role="status" className={cn('text-xs rounded-md px-3 py-2 border', msg.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200')}>{msg.text}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" disabled={busy || list.length >= TEMPLATE_LIMITS.count} className={buttonClass.secondary}
              onClick={() => { setList(prev => [...prev, { id: newId(), label: '', subject: '', body: '' }]); setMsg(null) }}>
              <Plus className="w-3.5 h-3.5" /> Agregar plantilla
            </button>
            {isOrg && (
              <button type="button" disabled={busy} onClick={restore} className={buttonClass.ghost}>
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar originales
              </button>
            )}
          </div>
          <button type="button" disabled={busy} onClick={save} className={buttonClass.primary}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar plantillas
          </button>
        </div>
      </div>
    </div>
  )
}
