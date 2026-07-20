import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentProfile } from '@/lib/supabase/server'
import { canSeeDeal } from '@/lib/visibility'

// Análisis IA de un deal: resumen, próxima acción sugerida y riesgo.
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno' },
      { status: 503 }
    )
  }

  let userId: string, role: string, supabase
  try {
    const ctx = await getCurrentProfile()
    userId = ctx.user.id
    role = ctx.role
    supabase = ctx.supabase
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { dealId } = await request.json()
  if (!dealId) return NextResponse.json({ error: 'dealId requerido' }, { status: 400 })

  const hasAccess = await canSeeDeal(supabase, userId, role, dealId)
  if (!hasAccess) return NextResponse.json({ error: 'Sin acceso a este deal' }, { status: 403 })

  // Reunir todo el contexto del deal
  const [{ data: deal }, { data: whatsapp }, { data: interactions }, { data: history }, { data: tasks }] =
    await Promise.all([
      supabase.from('deals')
        .select('stage, status, estimated_value, probability, source, next_action, score, created_at, last_contacted_at, lost_reason, lost_comment, companies(name, industry), contacts:primary_contact_id(full_name, job_title)')
        .eq('id', dealId).single(),
      supabase.from('whatsapp_messages')
        .select('direction, body, created_at')
        .eq('deal_id', dealId).order('created_at', { ascending: true }).limit(100),
      supabase.from('interactions')
        .select('type, notes, created_at')
        .eq('deal_id', dealId).order('created_at', { ascending: true }).limit(50),
      supabase.from('pipeline_stage_history')
        .select('from_stage, to_stage, changed_at')
        .eq('deal_id', dealId).order('changed_at', { ascending: true }).limit(30),
      supabase.from('tasks')
        .select('title, is_completed, due_date')
        .eq('deal_id', dealId).order('due_date', { ascending: true }).limit(30),
    ])

  if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

  const context = {
    deal: {
      empresa: (deal as any).companies?.name,
      industria: (deal as any).companies?.industry,
      contacto: (deal as any).contacts?.full_name,
      cargo_contacto: (deal as any).contacts?.job_title,
      etapa: deal.stage,
      estado: deal.status,
      valor_estimado: deal.estimated_value,
      probabilidad: deal.probability,
      fuente: deal.source,
      proxima_accion_registrada: deal.next_action,
      score: deal.score,
      creado: deal.created_at,
      ultimo_contacto: deal.last_contacted_at,
      razon_perdida: deal.lost_reason,
      comentario_perdida: deal.lost_comment,
    },
    mensajes_whatsapp: (whatsapp ?? []).map(m => ({
      quien: m.direction === 'inbound' ? 'cliente' : 'nosotros',
      texto: m.body,
      fecha: m.created_at,
    })),
    interacciones: interactions ?? [],
    historial_etapas: history ?? [],
    tareas: tasks ?? [],
  }

  const anthropic = new Anthropic()

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              resumen: {
                type: 'string',
                description: 'Resumen ejecutivo del estado del deal en 2-4 frases, en español',
              },
              proxima_accion: {
                type: 'string',
                description: 'La próxima acción concreta recomendada para avanzar este deal, en español',
              },
              riesgo: {
                type: 'string',
                enum: ['bajo', 'medio', 'alto'],
                description: 'Nivel de riesgo de perder este deal',
              },
              razon_riesgo: {
                type: 'string',
                description: 'Explicación breve del nivel de riesgo asignado, en español',
              },
            },
            required: ['resumen', 'proxima_accion', 'riesgo', 'razon_riesgo'],
            additionalProperties: false,
          },
        },
      },
      system:
        'Eres un analista comercial senior de Autopilot SpA, una agencia chilena de automatización. ' +
        'Analizas deals del CRM y entregas diagnósticos accionables en español chileno profesional. ' +
        'Todos los valores monetarios están en pesos chilenos (CLP). ' +
        'Sé directo y concreto: la próxima acción debe ser algo que el ejecutivo pueda hacer hoy. ' +
        'Considera el tiempo sin contacto, el tono de los mensajes de WhatsApp, la etapa del pipeline y las tareas pendientes.',
      messages: [
        {
          role: 'user',
          content: `Analiza este deal y entrega tu diagnóstico:\n\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'El análisis no pudo completarse' }, { status: 502 })
    }

    const text = response.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') {
      return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, insights: JSON.parse(text.text) })
  } catch (err: any) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Límite de uso de IA alcanzado, intenta en unos minutos' }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY inválida' }, { status: 503 })
    }
    return NextResponse.json({ error: `Error del análisis IA: ${err?.message ?? 'desconocido'}` }, { status: 502 })
  }
}
