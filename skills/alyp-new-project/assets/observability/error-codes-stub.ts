// Stub — reemplazar con instalación completa via skill alyp-observability
export const CODIGOS = {
  ERR_NEGOCIO_GENERICO: 'ERR_NEGOCIO_GENERICO',
  ERR_VALIDACION: 'ERR_VALIDACION',
  ERR_NO_AUTORIZADO: 'ERR_NO_AUTORIZADO',
  REGLA_RLS_VIOLADA: 'REGLA_RLS_VIOLADA',
  REGISTRO_NO_ENCONTRADO: 'REGISTRO_NO_ENCONTRADO',
  VIOLACION_UNICIDAD: 'VIOLACION_UNICIDAD',
  VIOLACION_LLAVE_FORANEA: 'VIOLACION_LLAVE_FORANEA',
} as const;
export type CodigoError = keyof typeof CODIGOS;
export function mapearCodigoPostgres(code?: string): CodigoError {
  switch (code) {
    case '42501': return 'REGLA_RLS_VIOLADA';
    case '23505': return 'VIOLACION_UNICIDAD';
    case '23503': return 'VIOLACION_LLAVE_FORANEA';
    case 'PGRST116': return 'REGISTRO_NO_ENCONTRADO';
    default: return 'ERR_NEGOCIO_GENERICO';
  }
}
