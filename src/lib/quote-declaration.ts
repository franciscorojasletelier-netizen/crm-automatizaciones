// Texto que el cliente acepta al firmar una cotización. Uno solo para la
// página del cliente y la copia que se guarda (deben ser idénticos).
export function acceptanceDeclaration(quoteNumber: number, company: string | null) {
  return `Acepto la cotización N° ${quoteNumber} y sus condiciones de pago, y me obligo${company ? `, en representación de ${company},` : ''} al pago del total indicado según el plan de pagos.`
}
