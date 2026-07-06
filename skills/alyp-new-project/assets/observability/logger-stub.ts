// Stub — reemplazar con instalación completa via skill alyp-observability
export type Nivel = 'debug' | 'info' | 'warn' | 'error';
export interface ContextoLog { traceId: string; contexto: string; codigo?: string; [k: string]: unknown; }
export const agenticLogger = {
  error: (_ctx: ContextoLog, _err: unknown) => {},
  warn:  (_ctx: ContextoLog, _msg?: string) => {},
  info:  (_ctx: ContextoLog, _msg?: string) => {},
  debug: (_ctx: ContextoLog, _msg?: string) => {},
};
export function nuevoTraceId(): string { return `tr_${Date.now()}_${Math.random().toString(36).slice(2,10)}`; }
export function crearLoggerDeRuta(traceId: string, contexto: string, meta: Record<string,unknown> = {}) {
  const base = (): ContextoLog => ({ traceId, contexto, ...meta });
  return {
    traceId,
    info:  (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.info({ ...base(), ...m }, msg),
    warn:  (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.warn({ ...base(), ...m }, msg),
    debug: (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.debug({ ...base(), ...m }, msg),
    error: (err: unknown, ex: { codigo?: string; [k: string]: unknown } = {}) => agenticLogger.error({ ...base(), ...ex }, err),
  };
}
