// Traduce errores crudos de Postgres/PostgREST a mensajes en español que un
// usuario puede entender, sin exponer nombres de tabla/constraint/columna.
//
// Ojo: muchos triggers propios de este proyecto (pipeline_stages, deals,
// etc.) ya lanzan `raise exception` con mensajes en español pensados para
// mostrarse tal cual (ej. "La clave de una etapa no se puede cambiar...").
// Esta función los deja pasar sin tocar — solo intercepta los que tienen
// pinta de error técnico crudo de Postgres.
const RAW_PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /duplicate key value violates unique constraint/i, message: 'Ya existe un registro con ese valor.' },
  { test: /violates foreign key constraint/i, message: 'La acción hace referencia a un dato que no existe o ya se eliminó.' },
  { test: /null value in column .* violates not-null constraint/i, message: 'Falta completar un campo obligatorio.' },
  { test: /violates check constraint/i, message: 'Ese valor no es válido para este campo.' },
  { test: /new row violates row-level security policy|permission denied for (table|relation)/i, message: 'No tenés permiso para hacer esta acción.' },
  { test: /relation ".*" does not exist|could not find the table/i, message: 'Error de configuración interna. Contactá a soporte.' },
  { test: /JWT|invalid claim|invalid signature/i, message: 'Tu sesión expiró. Volvé a iniciar sesión.' },
]

// Si el mensaje trae jerga técnica de Postgres que ninguno de los patrones
// de arriba reconoció puntualmente, igual no lo mostramos crudo.
const LOOKS_TECHNICAL = /\brelation ".*"|\bcolumn ".*"|\bconstraint ".*"|PGRST\d|invalid input syntax|syntax error at or near/i

export function friendlyError(rawMessage: string | null | undefined, fallback = 'Ocurrió un error. Intentá de nuevo.'): string {
  if (!rawMessage) return fallback
  for (const { test, message } of RAW_PATTERNS) {
    if (test.test(rawMessage)) return message
  }
  if (LOOKS_TECHNICAL.test(rawMessage)) return fallback
  // No tiene pinta de error crudo de Postgres — probablemente ya es un
  // mensaje propio, pensado para mostrarse (ej. triggers de pipeline_stages).
  return rawMessage
}
