// ============================================================
//  Campos personalizados por organización (deals / companies / contacts).
//  Ver src/lib/stages.ts para la contraparte de etapas — mismo patrón.
// ============================================================

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'date'
  | 'select' | 'multiselect' | 'boolean'

export type FieldEntity = 'deal' | 'company' | 'contact'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldDefinition {
  id: string
  entity: FieldEntity
  key: string
  label: string
  fieldType: FieldType
  options: FieldOption[]
  placeholder: string | null
  helpText: string | null
  isRequired: boolean
  sortOrder: number
  isActive: boolean
}

function toField(r: any): FieldDefinition {
  return {
    id: r.id,
    entity: r.entity,
    key: r.key,
    label: r.label,
    fieldType: r.field_type,
    options: Array.isArray(r.options) ? r.options : [],
    placeholder: r.placeholder,
    helpText: r.help_text,
    isRequired: r.is_required,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }
}

const SELECT = `
  id, entity, key, label, field_type, options,
  placeholder, help_text, is_required, sort_order, is_active
`

// orgId obligatorio si quien consulta puede ser platform_owner — mismo
// motivo que en getStages/getDisabledModules: su policy de SELECT bypasea
// el filtro de organización.
export async function getFieldDefinitions(supabase: any, entity: FieldEntity, orgId?: string): Promise<FieldDefinition[]> {
  let q = supabase.from('field_definitions').select(SELECT).eq('entity', entity).eq('is_active', true)
  if (orgId) q = q.eq('organization_id', orgId)
  const { data } = await q.order('sort_order', { ascending: true })
  return (data ?? []).map(toField)
}

/** Formatea un valor de custom_fields para mostrarlo, según el tipo de campo. */
export function formatFieldValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (field.fieldType === 'boolean') return value ? 'Sí' : 'No'
  if (field.fieldType === 'select') {
    return field.options.find(o => o.value === value)?.label ?? String(value)
  }
  if (field.fieldType === 'multiselect' && Array.isArray(value)) {
    return value.map(v => field.options.find(o => o.value === v)?.label ?? v).join(', ')
  }
  if (field.fieldType === 'currency' && typeof value === 'number') {
    return value.toLocaleString('es-CL')
  }
  return String(value)
}
