// utils/logger.ts
// Agentic-First Logging Standard — Logger Universal
// Cero dependencias. Funciona en Next.js, Express, workers, scripts.
//
// Las 3 Reglas de Oro:
//   1. Errores SIEMPRE en JSON estructurado: { traceId, contexto, error }.
//   2. Honeypot: la ubicación apunta a TU código, nunca a node_modules.
//   3. Salida agnóstica: solo stdout/stderr. Persistencia delegada a la plataforma.

export type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEN: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const NIVEL_MIN: number =
  ORDEN[(process.env.LOG_LEVEL as Nivel) ??
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug')] ?? 20;

const SERVICIO = process.env.SERVICE_NAME ?? 'app';
const ENV      = process.env.NODE_ENV ?? 'development';
const RELEASE  =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_SHA ??
  process.env.RELEASE ?? null;

// Directorios de TU código. Configurable sin tocar código.
const APP_DIRS = (
  process.env.APP_SOURCE_DIRS ??
  'src,app,pages,lib,server,components,utils,actions,services,packages'
)
  .split(',')
  .map((s) => `/${s.trim().replace(/^\/|\/$/g, '')}/`);

// Claves sensibles a redactar (recursivo, anti-circular).
const CLAVES_SENSIBLES = new Set(
  (
    process.env.LOG_REDACT_KEYS ??
    'password,pass,token,secret,secreto,apikey,api_key,authorization,auth,' +
    'cookie,creditcard,tarjeta,cvv,cedula,salario,sueldo,cuenta,iban,clabe'
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
);

export interface ContextoLog {
  traceId:  string;
  contexto: string;
  codigo?:  string;
  [k: string]: unknown;
}

interface Ubicacion {
  archivo: string | null;
  linea:   number | null;
  columna: number | null;
  funcion: string | null;
  raw:     string;
}

// Redacción recursiva, no mutante, anti-referencias-circulares.
function scrub(valor: unknown, vistos = new WeakSet<object>()): unknown {
  if (valor === null || typeof valor !== 'object') return valor;
  if (vistos.has(valor as object)) return '[Circular]';
  vistos.add(valor as object);
  if (Array.isArray(valor)) return valor.map((v) => scrub(v, vistos));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    out[k] = CLAVES_SENSIBLES.has(k.toLowerCase()) ? '[REDACTED]' : scrub(v, vistos);
  }
  return out;
}

// Honeypot: prioriza líneas del stack que pertenecen a TU código.
function esRuido(linea: string): boolean {
  return (
    linea.includes('node_modules') ||
    linea.includes('node:internal') ||
    linea.includes('webpack-internal') ||
    linea.includes('(<anonymous>)') ||
    /[\\/]utils[\\/]logger\.(t|j)s/.test(linea)
  );
}

function normalizarArchivo(p: string): string {
  if (p.startsWith('file://')) {
    try { return decodeURIComponent(p.replace(/^file:\/\//, '')); }
    catch { return p.replace(/^file:\/\//, ''); }
  }
  return p;
}

function parseLinea(l: string): Omit<Ubicacion, 'raw'> {
  const conParen = l.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
  if (conParen) {
    return {
      funcion: conParen[1],
      archivo: normalizarArchivo(conParen[2]),
      linea:   +conParen[3],
      columna: +conParen[4],
    };
  }
  const sinParen = l.match(/at\s+(.+?):(\d+):(\d+)/);
  if (sinParen) {
    return { funcion: null, archivo: normalizarArchivo(sinParen[1]), linea: +sinParen[2], columna: +sinParen[3] };
  }
  return { funcion: null, archivo: null, linea: null, columna: null };
}

function extraerUbicacion(stack: string | undefined): Ubicacion {
  const vacio: Ubicacion = { archivo: null, linea: null, columna: null, funcion: null, raw: 'Ubicación desconocida' };
  if (!stack) return vacio;
  const lineas = stack.split('\n').slice(1).map((l) => l.trim());
  const propia =
    lineas.find((l) => APP_DIRS.some((d) => l.includes(d)) && !esRuido(l)) ??
    lineas.find((l) => !esRuido(l));
  const raw = propia ?? lineas[0] ?? vacio.raw;
  return { ...parseLinea(raw), raw };
}

function evento(nivel: Exclude<Nivel, 'error'>, ctx: ContextoLog, mensaje?: string): void {
  if (ORDEN[nivel] < NIVEL_MIN) return;
  const { traceId, contexto, codigo, ...meta } = ctx;
  const log = {
    nivel, servicio: SERVICIO, env: ENV, release: RELEASE,
    timestamp: new Date().toISOString(),
    traceId: traceId ?? null,
    contexto: contexto ?? null,
    mensaje: mensaje ?? null,
    metadata: scrub(meta),
  };
  const linea = JSON.stringify(log);
  if (nivel === 'warn') process.stderr.write(linea + '\n');
  else process.stdout.write(linea + '\n');
}

export const agenticLogger = {
  /** Error estructurado con honeypot. Usar en TODOS los catch. */
  error(ctx: ContextoLog, error: unknown): void {
    if (ORDEN.error < NIVEL_MIN) return;
    const err  = error instanceof Error ? error : new Error(String(error));
    const ubic = extraerUbicacion(err.stack);
    const { traceId, contexto, codigo, ...meta } = ctx;
    const log = {
      nivel: 'error' as const,
      servicio: SERVICIO, env: ENV, release: RELEASE,
      timestamp: new Date().toISOString(),
      traceId: traceId ?? null,
      contexto: contexto ?? null,
      metadata: scrub(meta),
      error: {
        mensaje:          err.message,
        codigo:           codigo ?? (error as { code?: string })?.code ?? 'ERR_NEGOCIO_GENERICO',
        ubicacion_exacta: ubic.raw,
        archivo:          ubic.archivo,
        linea:            ubic.linea,
        columna:          ubic.columna,
        funcion:          ubic.funcion,
        stack_snippet:    (err.stack ?? '').split('\n').slice(0, 4).map((l) => l.trim()),
      },
    };
    process.stderr.write(JSON.stringify(log) + '\n');
  },
  warn(ctx: ContextoLog, mensaje?: string):  void { evento('warn',  ctx, mensaje); },
  info(ctx: ContextoLog, mensaje?: string):  void { evento('info',  ctx, mensaje); },
  debug(ctx: ContextoLog, mensaje?: string): void { evento('debug', ctx, mensaje); },
};

/** Genera un traceId único. Usa crypto.randomUUID si está disponible. */
export function nuevoTraceId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  return uuid ?? `tr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Logger ligado a una operación: no repites traceId/contexto en cada llamada.
 *
 * const log = crearLoggerDeRuta(nuevoTraceId(), 'checkout:crear-orden', { orderId });
 * log.info('inicio');
 * try { ... } catch (e) { log.error(e, { codigo: 'PAGO_RECHAZADO' }); }
 */
export function crearLoggerDeRuta(
  traceId: string,
  contexto: string,
  metaBase: Record<string, unknown> = {}
) {
  const base = (): ContextoLog => ({ traceId, contexto, ...metaBase });
  return {
    traceId,
    info:  (mensaje?: string, meta: Record<string, unknown> = {}) => agenticLogger.info({ ...base(), ...meta }, mensaje),
    warn:  (mensaje?: string, meta: Record<string, unknown> = {}) => agenticLogger.warn({ ...base(), ...meta }, mensaje),
    debug: (mensaje?: string, meta: Record<string, unknown> = {}) => agenticLogger.debug({ ...base(), ...meta }, mensaje),
    error: (error: unknown, extra: { codigo?: string; [k: string]: unknown } = {}) =>
      agenticLogger.error({ ...base(), ...extra }, error),
  };
}
