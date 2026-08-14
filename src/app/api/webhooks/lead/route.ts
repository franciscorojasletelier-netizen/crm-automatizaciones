import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { friendlyError } from '@/lib/pg-error'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  // Cliente creado dentro del handler para que las env vars estén disponibles
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim()
  )

  try {
    // El token en el header YA identifica a la organización: cada una
    // tiene el suyo propio en platform_integrations (provider=webhook_form),
    // configurado por el dueño de la plataforma en /plataforma/[id]. Antes,
    // un único WEBHOOK_SECRET_TOKEN + WEBHOOK_DEFAULT_ORG_EMAIL mandaban
    // TODOS los leads de CUALQUIER formulario a una sola organización fija
    // — no había forma de que un segundo cliente tuviera su propio webhook.
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (!bearerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const { data: integration } = await supabase
      .from('platform_integrations')
      .select('organization_id')
      .eq('provider', 'webhook_form')
      .eq('access_token', bearerToken)
      .eq('is_active', true)
      .maybeSingle()

    // Compatibilidad: si esta organización todavía no migró a un token
    // propio, se sostiene el mecanismo anterior (variable de entorno
    // única) para no romper al único cliente que existe hoy.
    let orgId = integration?.organization_id ?? null
    if (!orgId) {
      const legacyToken = process.env.WEBHOOK_SECRET_TOKEN?.trim()
      const legacyEmail = process.env.WEBHOOK_DEFAULT_ORG_EMAIL?.trim()
      if (legacyToken && legacyEmail && bearerToken === legacyToken) {
        const { data: ownerProfile } = await supabase
          .from('profiles').select('organization_id').eq('email', legacyEmail).maybeSingle()
        orgId = (ownerProfile as any)?.organization_id ?? null
      }
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, display_name, email, notification_email')
      .eq('id', orgId)
      .maybeSingle()
    const orgDisplayName = org?.display_name || org?.name || 'nuestro equipo'

    const body = await request.json()

    // Campos esperados (todos opcionales excepto company_name o contact_name)
    // Acepta tanto el formato CRM (contact_name, company_name) como el del formulario web (name, company, email, phone)
    const company_name    = body.company_name  ?? body.company ?? null
    const contact_name    = body.contact_name  ?? body.name    ?? null
    const contact_email   = body.contact_email ?? body.email   ?? null
    const contact_phone   = body.contact_phone ?? body.phone   ?? null
    const contact_job_title = body.contact_job_title ?? null
    const industry        = body.industry  ?? null
    const website         = body.website   ?? null
    const source          = body.source    ?? 'Formulario web'
    const estimated_value = body.estimated_value ?? null
    const next_action     = body.next_action ?? null
    const message         = body.message   ?? body.details ?? null

    if (!company_name && !contact_name) {
      return NextResponse.json({ error: 'Se requiere company_name, contact_name, name o company' }, { status: 400 })
    }

    // ── DEDUPLICACIÓN: buscar contacto existente por email ─────
    let company: { id: string } | null = null
    let contact: { id: string } | null = null
    let isDuplicate = false

    if (contact_email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .eq('organization_id', orgId)
        .ilike('email', contact_email.trim())
        .limit(1)
        .maybeSingle()

      if (existingContact) {
        isDuplicate = true
        contact = { id: existingContact.id }
        company = existingContact.company_id ? { id: existingContact.company_id } : null

        // Si ya tiene un deal abierto, no crear otro: registrar interacción y salir
        const { data: openDeal } = await supabase
          .from('deals')
          .select('id')
          .eq('primary_contact_id', existingContact.id)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle()

        if (openDeal) {
          await supabase.from('interactions').insert({
            deal_id: openDeal.id,
            contact_id: existingContact.id,
            type: 'note',
            direction: 'inbound',
            content: `🔁 El lead volvió a contactar via ${source}${message ? `:\n${message}` : ''}`,
          })
          return NextResponse.json({
            success: true,
            duplicate: true,
            lead_id: openDeal.id,
            message: 'Contacto existente con deal abierto — interacción registrada',
          }, { status: 200, headers: CORS_HEADERS })
        }
      }
    }

    // Buscar empresa existente por nombre si no la tenemos del contacto
    if (!company && company_name) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', company_name.trim())
        .limit(1)
        .maybeSingle()
      if (existingCompany) company = { id: existingCompany.id }
    }

    // Crear empresa solo si no existe
    if (!company) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: company_name ?? contact_name, industry, website, organization_id: orgId })
        .select('id').single()
      if (companyError) throw companyError
      company = newCompany
    }

    // Crear contacto solo si no existe
    if (!contact) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: company!.id,
          full_name: contact_name ?? company_name,
          email: contact_email,
          phone: contact_phone,
          job_title: contact_job_title,
          organization_id: orgId,
        })
        .select('id').single()
      if (contactError) throw contactError
      contact = newContact
    }

    // ── ASIGNACIÓN AUTOMÁTICA (round-robin por carga) ──────────
    // El comercial activo con menos deals abiertos recibe el lead
    let assignedOwnerId: string | null = null
    const { data: comerciales } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', orgId)
      .eq('role', 'comercial')
      .eq('is_active', true)

    if (comerciales && comerciales.length > 0) {
      const counts = await Promise.all(comerciales.map(async c => {
        const { count } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', c.id)
          .eq('status', 'open')
        return { id: c.id, name: c.full_name, count: count ?? 0 }
      }))
      counts.sort((a, b) => a.count - b.count)
      assignedOwnerId = counts[0].id
    }

    // Calcular score inicial
    let score = 0
    if (contact_email && !contact_email.includes('gmail') && !contact_email.includes('hotmail')) score += 15
    if (source === 'Meta Ads' || source === 'LinkedIn') score += 10
    if (industry) score += 5

    // Crear deal (asignado automáticamente al comercial con menos carga)
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_id: company!.id,
        primary_contact_id: contact!.id,
        owner_id: assignedOwnerId,
        source,
        estimated_value: estimated_value ? parseFloat(estimated_value) : null,
        next_action: next_action ?? 'Contactar lead entrante',
        score,
        // `stage` omitido: lo asigna el trigger según la organización destino.
        status: 'open',
        organization_id: orgId,
      })
      .select('id').single()

    if (dealError) throw dealError

    // ── NOTIFICACIONES IN-APP ──────────────────────────────────
    const notifTargets: { user_id: string; title: string; body: string }[] = []

    // Al comercial asignado
    if (assignedOwnerId) {
      notifTargets.push({
        user_id: assignedOwnerId,
        title: `🆕 Nuevo lead asignado: ${company_name ?? contact_name}`,
        body: `Fuente: ${source}${contact_email ? ` · ${contact_email}` : ''} — contactar pronto`,
      })
    }

    // A los gerentes
    const { data: gerentes } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['gerente', 'super_admin', 'admin'])
      .eq('is_active', true)
    gerentes?.forEach(g => {
      if (g.id !== assignedOwnerId) {
        notifTargets.push({
          user_id: g.id,
          title: `📥 Lead entrante: ${company_name ?? contact_name}`,
          body: `Fuente: ${source}${isDuplicate ? ' · contacto recurrente' : ''}`,
        })
      }
    })

    if (notifTargets.length > 0) {
      await supabase.from('notifications').insert(
        notifTargets.map(n => ({
          ...n,
          type: 'deal_assigned',
          entity_type: 'deal',
          entity_id: deal.id,
        }))
      )
    }

    // Registrar mensaje inicial como interacción si viene del formulario
    if (message) {
      await supabase.from('interactions').insert({
        deal_id: deal.id,
        contact_id: contact.id,
        type: 'note',
        direction: 'inbound',
        content: `Mensaje del formulario web:\n${message}`,
      })
    }

    // Enviar emails automáticos (sin bloquear la respuesta)
    const resendKey = process.env.RESEND_API_KEY?.trim()
    if (resendKey && contact_email) {
      const resend = new Resend(resendKey)
      // Email al cliente
      resend.emails.send({
        from: process.env.EMAIL_FROM?.trim() || `${orgDisplayName} <onboarding@resend.dev>`,
        to: contact_email,
        subject: `¡Recibimos tu mensaje! — ${orgDisplayName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#111">¡Hola${contact_name ? ` ${contact_name.split(' ')[0]}` : ''}! 👋</h2>
            <p style="color:#444;line-height:1.6">
              Gracias por contactarnos. Recibimos tu mensaje y uno de nuestros especialistas
              te responderá en <strong>menos de 2 horas hábiles</strong>.
            </p>
            ${message ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:24px 0;color:#555;font-style:italic;">"${message}"</div>` : ''}
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
            <p style="color:#999;font-size:12px;">${orgDisplayName}</p>
          </div>
        `,
      }).catch(e => console.warn('Error email cliente:', e))
    }

    if (resendKey && org?.notification_email) {
      const resend = new Resend(resendKey)
      // Notificación interna — solo a la organización dueña del lead
      resend.emails.send({
        from: process.env.EMAIL_FROM?.trim() || `CRM ${orgDisplayName} <onboarding@resend.dev>`,
        to: org.notification_email,
        subject: `🔔 Nuevo lead: ${contact_name ?? company_name} (${source})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#111">Nuevo lead recibido</h2>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;color:#666;width:140px;">Nombre</td><td style="padding:8px;font-weight:bold;">${contact_name ?? '—'}</td></tr>
              <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;">${contact_email ?? '—'}</td></tr>
              <tr><td style="padding:8px;color:#666;">Teléfono</td><td style="padding:8px;">${contact_phone ?? '—'}</td></tr>
              <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Empresa</td><td style="padding:8px;">${company_name ?? '—'}</td></tr>
              <tr><td style="padding:8px;color:#666;">Fuente</td><td style="padding:8px;">${source}</td></tr>
              ${message ? `<tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Mensaje</td><td style="padding:8px;">${message}</td></tr>` : ''}
            </table>
            <a href="https://crm-automatizaciones.vercel.app/leads"
               style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Ver en el CRM →
            </a>
          </div>
        `,
      }).catch(e => console.warn('Error email interno:', e))
    }

    return NextResponse.json({
      success: true,
      lead_id: deal.id,
      company_id: company.id,
      contact_id: contact.id,
    }, { status: 201, headers: CORS_HEADERS })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: friendlyError(error.message, 'Error interno') }, { status: 500, headers: CORS_HEADERS })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/webhooks/lead' })
}

