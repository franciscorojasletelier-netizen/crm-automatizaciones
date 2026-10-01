'use client'

// Datos de la empresa que aparecen en correos de cobranza, estados de
// cuenta y cotizaciones. Lo editan gerentes y administradores (RLS).

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonClass, inputClass, labelClass } from '@/components/ui/page'
import { cn } from '@/lib/utils'

export interface CompanyProfile {
  id: string
  name: string
  display_name: string | null
  logo_url: string | null
  email: string | null
  phone: string | null
  address: string | null
  payment_instructions: string | null
}

const MAX_LOGO = 512 * 1024

export default function CompanyProfileCard({ org }: { org: CompanyProfile }) {
  const [v, setV] = useState({
    display_name: org.display_name ?? '', email: org.email ?? '', phone: org.phone ?? '',
    address: org.address ?? '', payment_instructions: org.payment_instructions ?? '',
  })
  const [logo, setLogo] = useState(org.logo_url)
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(p => ({ ...p, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) { setMsg({ ok: false, text: 'El correo no es válido.' }); return }
    setBusy('save'); setMsg(null)
    const clean = (s: string) => s.trim() || null
    const { error } = await createClient().from('organizations').update({
      display_name: clean(v.display_name), email: clean(v.email), phone: clean(v.phone),
      address: clean(v.address), payment_instructions: clean(v.payment_instructions),
    }).eq('id', org.id)
    setBusy(null)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Guardado. Se usa en los próximos correos y documentos.' })
    if (!error) router.refresh()
  }

  async function uploadLogo(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMsg({ ok: false, text: 'El logo debe ser PNG, JPG o WebP.' }); return }
    if (file.size > MAX_LOGO) { setMsg({ ok: false, text: 'El logo no puede pesar más de 512 KB.' }); return }
    setBusy('logo'); setMsg(null)
    const sb = createClient()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    // Nombre nuevo en cada subida: los clientes de correo cachean la URL.
    const path = `${org.id}/logo-${Date.now()}.${ext}`
    const { error: upErr } = await sb.storage.from('logos').upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) { setBusy(null); setMsg({ ok: false, text: upErr.message }); return }
    const url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl
    const { error } = await sb.from('organizations').update({ logo_url: url }).eq('id', org.id)
    setBusy(null)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setLogo(url); setMsg({ ok: true, text: 'Logo actualizado.' }); router.refresh()
  }

  async function removeLogo() {
    setBusy('logo'); setMsg(null)
    const { error } = await createClient().from('organizations').update({ logo_url: null }).eq('id', org.id)
    setBusy(null)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setLogo(null); router.refresh()
  }

  return (
    <form onSubmit={save} className="bg-card rounded-lg border border-slate-200 shadow-xs">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-500" /> Datos de la empresa</h2>
        <p className="text-xs text-slate-500 mt-0.5">Aparecen en los correos de cobranza, estados de cuenta y cotizaciones.</p>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-28 h-14 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL pública de Storage, tamaño fijo */}
            {logo ? <img src={logo} alt="Logo de la empresa" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-slate-400">Sin logo</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={buttonClass.secondary}>
              {busy === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} {logo ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logo && (
              <button type="button" onClick={removeLogo} disabled={busy !== null} className={cn(buttonClass.ghost, 'hover:text-red-700')}>
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
            <p className="basis-full text-xs text-slate-500">PNG, JPG o WebP, hasta 512 KB. Ideal: horizontal y con fondo transparente.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cp-name" className={labelClass}>Nombre visible</label>
            <input id="cp-name" value={v.display_name} onChange={set('display_name')} placeholder={org.name} maxLength={120} className={inputClass} />
          </div>
          <div>
            <label htmlFor="cp-email" className={labelClass}>Correo de contacto</label>
            <input id="cp-email" type="email" value={v.email} onChange={set('email')} placeholder="cobranza@empresa.cl" className={inputClass} />
          </div>
          <div>
            <label htmlFor="cp-phone" className={labelClass}>Teléfono</label>
            <input id="cp-phone" value={v.phone} onChange={set('phone')} placeholder="+56 2 2345 6789" className={inputClass} />
          </div>
          <div>
            <label htmlFor="cp-address" className={labelClass}>Dirección</label>
            <input id="cp-address" value={v.address} onChange={set('address')} placeholder="Av. Providencia 1234, Santiago" className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="cp-pay" className={labelClass}>Cómo pagar <span className="font-normal text-slate-500">(se muestra en los cobros)</span></label>
          <textarea id="cp-pay" value={v.payment_instructions} onChange={set('payment_instructions')} rows={5} maxLength={1000}
            placeholder={'Transferencia a:\nBanco de Chile · Cuenta corriente 00-000-00000-00\nRazón social · RUT 77.777.777-7\nEnvía el comprobante a cobranza@empresa.cl'}
            className={cn(inputClass, 'h-auto py-2 leading-relaxed resize-y')} />
        </div>

        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={cn('text-[13px] rounded-md px-3 py-2 border',
            msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200')}>{msg.text}</p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={busy !== null} className={buttonClass.primary}>
            {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
          </button>
        </div>
      </div>
    </form>
  )
}
