// Formato de importación de leads: columnas aceptadas, cómo se reconocen los
// encabezados y cómo se leen los montos. Sin dependencias, para usarlo tanto
// en el modal (guía de columnas) como en el servidor (plantilla y lectura).

export type LeadField = 'company' | 'contact' | 'email' | 'phone' | 'job' | 'industry' | 'website' | 'source' | 'value'
export type ImportedLead = Record<LeadField, string>

export interface ImportColumn {
  field: LeadField
  header: string
  example: string
  help: string
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { field: 'company',  header: 'Empresa',        example: 'Constructora Los Andes', help: 'Obligatoria si no hay Contacto. Si ya existe, se reutiliza.' },
  { field: 'contact',  header: 'Contacto',       example: 'Juan Pérez',             help: 'Nombre de la persona. Obligatorio si no hay Empresa.' },
  { field: 'email',    header: 'Email',          example: 'juan@losandes.cl',       help: 'Si ya está registrado, la fila se omite (no se duplica).' },
  { field: 'phone',    header: 'Teléfono',       example: '+56 9 1234 5678',        help: 'Con código de país para poder escribir por WhatsApp.' },
  { field: 'job',      header: 'Cargo',          example: 'Gerente de operaciones', help: '' },
  { field: 'industry', header: 'Industria',      example: 'Construcción',           help: '' },
  { field: 'website',  header: 'Sitio web',      example: 'losandes.cl',            help: '' },
  { field: 'source',   header: 'Fuente',         example: 'Feria',                  help: 'Si va vacía queda como "Importación".' },
  { field: 'value',    header: 'Valor estimado', example: '5.000.000',              help: 'Solo el número, en la moneda de la organización.' },
]

export const IMPORT_MAX_ROWS = 1000

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// El orden importa: "Email del contacto" es email y "Nombre empresa" es
// empresa, así que los campos específicos se revisan antes que Contacto.
const HEADER_RULES: [LeadField, RegExp][] = [
  ['email',    /e-?mail|correo/],
  ['phone',    /fono|phone|tel|celular|movil|whatsapp/],
  ['website',  /web|sitio|url/],
  ['company',  /empresa|company|compania|razon social|cliente/],
  ['industry', /industria|industry|rubro|sector|giro/],
  ['job',      /cargo|puesto|job|title/],
  ['source',   /fuente|source|origen|canal/],
  ['value',    /valor|value|monto|presupuesto|budget/],
  ['contact',  /contacto|nombre|name|persona/],
]

export function mapHeader(header: string): LeadField | null {
  const n = norm(header)
  if (!n) return null
  return HEADER_RULES.find(([, re]) => re.test(n))?.[0] ?? null
}

/**
 * Lee un monto escrito a mano: "5.000.000" (Chile), "5,000,000", "$ 1.500",
 * "1234,50" o un número de Excel. Devuelve null si va vacío y NaN si no se
 * entiende.
 */
export function parseAmount(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN
  const s = raw.replace(/[\s$]|CLP|USD|UF/gi, '')
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''))
  if (/^\d+([.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'))
  return NaN
}

export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
