import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/pg-error'

async function requirePlatformOwner() {
  const { user, supabase } = await getCurrentProfile()
  const { data: owner } = await supabase
    .from('platform_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { supabase }
}

export async function POST(request: NextRequest) {
  const gate = await requirePlatformOwner()
  if (gate.error) return gate.error
  const { supabase } = gate

  const body = await request.json()
  const { organizationId, entity, key, label, fieldType, options, isRequired, placeholder, helpText, sortOrder } = body

  if (!organizationId || !entity || !key || !label || !fieldType) {
    return NextResponse.json({ error: 'organizationId, entity, key, label y fieldType son requeridos' }, { status: 400 })
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: 'La clave debe ser minúsculas, números y guión bajo, empezando con letra' }, { status: 400 })
  }
  if ((fieldType === 'select' || fieldType === 'multiselect') && (!Array.isArray(options) || options.length === 0)) {
    return NextResponse.json({ error: 'Un campo select/multiselect necesita al menos una opción' }, { status: 400 })
  }

  const { data, error } = await supabase.from('field_definitions').insert({
    organization_id: organizationId, entity, key, label, field_type: fieldType,
    options: options ?? [], is_required: !!isRequired,
    placeholder: placeholder || null, help_text: helpText || null, sort_order: sortOrder ?? 0,
  }).select('id').single()

  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePlatformOwner()
  if (gate.error) return gate.error
  const { supabase } = gate

  const body = await request.json()
  const { fieldId, ...fields } = body
  if (!fieldId) return NextResponse.json({ error: 'fieldId es requerido' }, { status: 400 })

  // `key` y `entity` tampoco se editan una vez creado el campo: cambiar la
  // clave rompería los valores ya guardados en custom_fields, que la
  // referencian tal cual quedó.
  delete fields.key
  delete fields.entity

  const { error } = await supabase.from('field_definitions').update(fields).eq('id', fieldId)
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 400 })
  return NextResponse.json({ ok: true })
}
