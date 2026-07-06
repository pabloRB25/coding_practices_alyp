// utils/error-codes.ts
// Códigos UPPER_SNAKE_CASE. Los agentes procesan códigos estables mejor que
// mensajes de texto variables. Extiende por vertical del proyecto.

export const CODIGOS = {
  // Genéricos
  ERR_NEGOCIO_GENERICO:    'ERR_NEGOCIO_GENERICO',
  ERR_VALIDACION:          'ERR_VALIDACION',
  ERR_NO_AUTORIZADO:       'ERR_NO_AUTORIZADO',
  ERR_TIMEOUT:             'ERR_TIMEOUT',
  ERR_INTEGRACION_EXTERNA: 'ERR_INTEGRACION_EXTERNA',

  // Datos / Supabase / Postgres
  REGLA_RLS_VIOLADA:      'REGLA_RLS_VIOLADA',
  REGISTRO_NO_ENCONTRADO: 'REGISTRO_NO_ENCONTRADO',
  VIOLACION_UNICIDAD:     'VIOLACION_UNICIDAD',
  VIOLACION_LLAVE_FORANEA:'VIOLACION_LLAVE_FORANEA',
  TABLA_INEXISTENTE:      'TABLA_INEXISTENTE',

  // Extender por vertical del proyecto:
  // STOCK_MINIMO_INSUFICIENTE: 'STOCK_MINIMO_INSUFICIENTE',
  // FACTURA_YA_EMITIDA:        'FACTURA_YA_EMITIDA',
  // PERIODO_PLANILLA_CERRADO:  'PERIODO_PLANILLA_CERRADO',
} as const;

export type CodigoError = keyof typeof CODIGOS;

/**
 * Mapea códigos Postgres/PostgREST a códigos internos.
 * Úsalo en el catch antes de loggear:
 *   log.error(e, { codigo: mapearCodigoPostgres((e as any).code) });
 */
export function mapearCodigoPostgres(code?: string): CodigoError {
  switch (code) {
    case '42501':   return 'REGLA_RLS_VIOLADA';
    case '23505':   return 'VIOLACION_UNICIDAD';
    case '23503':   return 'VIOLACION_LLAVE_FORANEA';
    case '42P01':   return 'TABLA_INEXISTENTE';
    case 'PGRST116':return 'REGISTRO_NO_ENCONTRADO';
    default:        return 'ERR_NEGOCIO_GENERICO';
  }
}
