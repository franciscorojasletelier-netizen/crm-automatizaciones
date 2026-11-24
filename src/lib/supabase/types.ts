// Tipos de la base. database.types.ts se genera con `npm run db:types`
// (no editarlo a mano); acá van los ajustes y alias que usa el resto del código.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database as Generated, Json } from './database.types'
import type { SectionMode } from '@/lib/roles'
import type { Tax } from '@/lib/money'
import type { PaymentTerm } from '@/lib/payment-terms'
import type { EmailTemplate, Treatment } from '@/lib/email-templates'
import type { QuoteItem } from '@/lib/quotes'
import type { EmailProvider } from '@/lib/email/oauth'
import type { AcceptanceSnapshot } from '@/lib/quote-acceptance'

type GenTables = Generated['public']['Tables']

/** Disparador de una regla o secuencia de automatización. */
export type TriggerConfig = { to_stage?: string; days?: number }
/** Acción de una regla o de un paso de secuencia. */
export type ActionConfig = { title?: string; days_after?: number; message?: string; template_id?: string }
type CustomFields = Record<string, unknown>

// Forma real de las columnas que el generador no puede saber: las jsonb
// (para él son Json) y los textos con valores acotados. Una columna que no
// esté acá queda con el tipo generado.
type ColumnShapes = {
  automation_logs: { details: Record<string, unknown> | null }
  automation_rules: { trigger_config: TriggerConfig; action_config: ActionConfig }
  automation_sequences: { trigger_config: TriggerConfig }
  automation_sequence_steps: { action_config: ActionConfig }
  companies: { custom_fields: CustomFields }
  email_accounts: { provider: EmailProvider }
  contacts: { custom_fields: CustomFields; treatment: Treatment }
  deals: { custom_fields: CustomFields }
  organizations: { taxes: Tax[]; payment_terms: PaymentTerm[]; email_templates: EmailTemplate[] | null }
  profiles: { section_access: Record<string, SectionMode> | string[] | null; email_templates: EmailTemplate[] | null }
  quotes: { items: QuoteItem[]; taxes: Tax[]; payment_terms: PaymentTerm[] | null; accepted_snapshot: AcceptanceSnapshot | null }
}
type JsonOf<T> = T extends keyof ColumnShapes ? ColumnShapes[T] : unknown
type WithJson<R, O> = unknown extends O ? R : Omit<R, keyof O> & O
type WithJsonPartial<R, O> = unknown extends O ? R : Omit<R, keyof O> & Partial<O>

// Columnas NOT NULL sin default que completa un trigger antes de insertar
// (set_org_from_*, pipeline y etapa por defecto, correlativos): al insertar
// son opcionales. organization_id aplica a todas las tablas que la tienen.
type TriggerFilled = {
  deals: 'pipeline_id' | 'stage'
  invoices: 'invoice_number'
  quotes: 'quote_number'
}
type FilledOf<T> = 'organization_id' | (T extends keyof TriggerFilled ? TriggerFilled[T] : never)
type OptionalKeys<I, K> = Omit<I, Extract<keyof I, K>> & Partial<Pick<I, Extract<keyof I, K>>>

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Tables'> & {
    Tables: {
      [T in keyof GenTables]: {
        Row: WithJson<GenTables[T]['Row'], JsonOf<T>>
        Insert: WithJsonPartial<OptionalKeys<GenTables[T]['Insert'], FilledOf<T>>, JsonOf<T>>
        Update: WithJsonPartial<GenTables[T]['Update'], JsonOf<T>>
        Relationships: GenTables[T]['Relationships']
      }
    }
  }
}

export type { Json }
/** Cliente de Supabase tipado con el esquema (sesión o service_role). */
export type Db = SupabaseClient<Database>
/** Valores para insertar o actualizar una tabla. */
export type Insert<T extends keyof GenTables> = Database['public']['Tables'][T]['Insert']
export type Update<T extends keyof GenTables> = Database['public']['Tables'][T]['Update']
/** Enum de Postgres: Enum<'user_role'>. */
export type Enum<E extends keyof Generated['public']['Enums']> = Generated['public']['Enums'][E]
export type UserRole = Enum<'user_role'>
/** Fila completa de una tabla: Row<'deals'>. */
export type Row<T extends keyof GenTables> = Database['public']['Tables'][T]['Row']
