# Alyp Studio — Observabilidad y Logs

Skill que instala la capa de observabilidad estándar de Alyp Studio en proyectos SaaS enterprise.

**Principio rector**: instrumentar una sola vez con estándares abiertos; el backend es decisión de proyecto, no de scaffold.

```
Tu código → agenticLogger (stdout/stderr JSON)
         → OTel SDK      (traces + métricas)
         → Plataforma    (Vercel Log Drains / OTLP exporter → cualquier backend)
```

**Sin vendor lock-in en el código de la app.** Cambiar de Axiom a Datadog a Grafana = cambiar credenciales, no código.

---

## Las 3 Reglas de Oro (no negociables)

1. **No plain-text errors** — todo error es JSON estructurado con `traceId`, `contexto`, `error`.
2. **Honeypot** — la ubicación loggeada apunta a TU código, nunca a `node_modules` ni internals del framework.
3. **Salida agnóstica** — la app solo escribe a stdout/stderr. La persistencia la delega la plataforma.

---

## Cuándo usar este skill

- Scaffolding de proyecto nuevo (FASE 5.5 de `alyp-new-project`)
- Auditar un proyecto existente que usa `console.log/console.error`
- Migrar desde un logger con dependencias a uno agnóstico

---

## FASE 1 — Detectar contexto

```bash
# Identificar estructura del proyecto
ls apps/ packages/ src/ 2>/dev/null
cat package.json | grep -E '"name"|"packageManager"'

# ¿Es Turborepo?
test -f turbo.json && echo "TURBOREPO" || echo "SIMPLE"
```

Anotar:
- `IS_MONOREPO` — true si existe `turbo.json`/`pnpm-workspace.yaml`
- `APP_DIRS` — rutas de las apps (ej: `apps/app`, `apps/web` o `src`)
- `UTILS_DIR` — dónde van los utilitarios (ej: `apps/app/src/utils` o `src/utils`)

---

## FASE 2 — Reemplazar stub de logger con implementación completa (`utils/logger.ts`)

El scaffold base (`alyp-new-project` FASE 3A) ya creó un stub tipado de `logger.ts`.
Esta fase lo reemplaza con la implementación completa: honeypot, PII scrub, niveles, helpers.

Sobreescribir `$UTILS_DIR/logger.ts`:

```typescript
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
```

---

## FASE 3 — Reemplazar stub de error-codes con implementación completa (`utils/error-codes.ts`)

Sobreescribir `$UTILS_DIR/error-codes.ts` con la versión completa:

```typescript
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
```

---

## FASE 4 — Instalar extractor agent-gps (`scripts/agent-gps.mjs`)

Crear `scripts/agent-gps.mjs` en la raíz del proyecto (o raíz del monorepo):

```javascript
#!/usr/bin/env node
// scripts/agent-gps.mjs
// Extractor multi-proveedor de logs. Uso: node scripts/agent-gps.mjs <traceId>
// LOG_PROVIDER=local | axiom | http

import { readFileSync } from 'fs';

const [, , traceId] = process.argv;
if (!traceId) { console.error('Uso: node scripts/agent-gps.mjs <traceId>'); process.exit(1); }

const provider = process.env.LOG_PROVIDER ?? 'local';

async function fetchLogs() {
  if (provider === 'local') {
    const file = process.env.LOG_LOCAL_FILE ?? 'logs/dev.log';
    try {
      return readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      console.error(`No se encontró ${file}. ¿Estás corriendo con: next dev | tee logs/dev.log?`);
      process.exit(1);
    }
  }

  if (provider === 'axiom' || provider === 'http') {
    const url     = process.env.LOG_PROVIDER_API_URL;
    const token   = process.env.LOG_PROVIDER_TOKEN;
    const dataset = process.env.LOG_DATASET;
    if (!url || !token) { console.error('Faltan LOG_PROVIDER_API_URL y LOG_PROVIDER_TOKEN'); process.exit(1); }

    const body = provider === 'axiom'
      ? JSON.stringify({ apl: `['${dataset}'] | where traceId == '${traceId}' | limit 50` })
      : JSON.stringify({ query: `traceId:${traceId}`, size: 50 });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    const rows = provider === 'axiom' ? (data.matches ?? []).map((m) => m.data) : (data.results ?? []);
    return rows.map((r) => JSON.stringify(r));
  }

  console.error(`LOG_PROVIDER desconocido: ${provider}`); process.exit(1);
}

const lines = await fetchLogs();
const entries = lines
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((e) => e && e.traceId === traceId);

if (!entries.length) {
  console.log(`No se encontraron logs para traceId: ${traceId}`);
  process.exit(0);
}

console.log(`\n=== GPS para traceId: ${traceId} ===\n`);
for (const e of entries) {
  if (e.nivel === 'error' && e.error) {
    console.log(`[ERROR] ${e.timestamp} | ${e.contexto}`);
    console.log(`  Mensaje:   ${e.error.mensaje}`);
    console.log(`  Código:    ${e.error.codigo}`);
    console.log(`  Ubicación: ${e.error.ubicacion_exacta}`);
    console.log(`  Stack:     ${(e.error.stack_snippet ?? []).join('\n             ')}`);
    console.log('');
    console.log('<<<AGENT_GPS_JSON>>>');
    console.log(JSON.stringify({
      archivo:  e.error.archivo,
      linea:    e.error.linea,
      funcion:  e.error.funcion,
      codigo:   e.error.codigo,
      mensaje:  e.error.mensaje,
      contexto: e.contexto,
    }, null, 2));
    console.log('<<<END_AGENT_GPS_JSON>>>');
  } else {
    console.log(`[${e.nivel?.toUpperCase()}] ${e.timestamp} | ${e.contexto} | ${e.mensaje ?? ''}`);
  }
}
```

Agregar a `package.json` (raíz del monorepo o del proyecto simple):
```json
{
  "scripts": {
    "agent:gps":   "node scripts/agent-gps.mjs",
    "logs:errors": "grep '\"nivel\":\"error\"' logs/dev.log || true"
  }
}
```

Agregar `logs/` a `.gitignore`.

### Patrón de debugging: RLS silencioso (0 filas sin error)

Un fallo de RLS frecuente **no lanza excepción** — simplemente devuelve 0 filas.
El agente recibe datos vacíos y no hay `traceId` que buscar con `agent:gps`.

**Síntoma**: query ejecutada sin error, resultado vacío inesperado.

**Cómo detectarlo y loggearlo correctamente**:

```typescript
// ❌ Patrón que oculta fallos de RLS
const { data } = await supabase.from('items').select('*');
return data; // puede ser [] por RLS, el agente no lo sabe

// ✅ Patrón que expone fallos de RLS
const log = crearLoggerDeRuta(nuevoTraceId(), 'items:listar', { orgId });
const { data, error, count } = await supabase
  .from('items').select('*', { count: 'exact' }).eq('org_id', orgId);

if (error) {
  log.error(error, { codigo: mapearCodigoPostgres((error as any).code) });
  throw error;
}

if (count === 0) {
  // Log explícito cuando esperamos datos pero RLS podría estar bloqueando
  log.warn('query retornó vacío — verificar RLS policy', { orgId, tabla: 'items' });
}

return data ?? [];
```

**Debugging cuando sospechas RLS**:
```bash
# 1. En Supabase Studio → SQL Editor, correr la query AS el usuario afectado:
SELECT set_config('request.jwt.claims', '{"sub":"USER_UUID"}', true);
SELECT * FROM items WHERE org_id = 'ORG_UUID';
-- Si devuelve vacío = RLS bloqueando

# 2. Verificar que existe policy para SELECT en la tabla:
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies WHERE tablename = 'items';

# 3. Verificar que el usuario tiene membership:
SELECT * FROM memberships WHERE user_id = 'USER_UUID';
```

> Agregar este patrón al protocolo de debugging del `CLAUDE.md` del proyecto.

---

## FASE 4.5 — Vercel Log Drain (transporte en producción)

> Sin Log Drain, los logs JSON escritos a stdout/stderr **no persisten** en Vercel.
> El filesystem serverless es efímero — `LOG_PROVIDER=local` es inútil en cualquier ambiente Vercel.
> El Log Drain es el puente entre "app escribe a stdout" y "backend almacena los logs".

### Opciones de transporte (elegir una por proyecto)

| Opción | Cuándo usar | Cómo |
|--------|------------|------|
| **Vercel Marketplace Integration** | Axiom, Datadog, Logtail tienen integración nativa | Dashboard → Integrations |
| **Log Drain HTTP genérico** | Cualquier endpoint OTLP/HTTP | API de Vercel |
| **Log Drain a tu propio endpoint** | Auto-hosted, máxima flexibilidad | API de Vercel |

### Configurar Log Drain via API (opción universal)

```bash
# Obtener el team ID y project IDs primero
# Reemplazar VERCEL_TOKEN, PROJECT_IDS y la URL del drain

curl -X POST "https://api.vercel.com/v1/integrations/log-drains" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-DRAIN-ENDPOINT/logs",
    "sources": ["build", "edge", "external"],
    "deliveryFormat": "json",
    "projectIds": ["prj_APP_ID", "prj_WEB_ID"],
    "headers": {
      "Authorization": "Bearer YOUR-DRAIN-TOKEN"
    }
  }'
```

### Mapeo de LOG_PROVIDER por ambiente (tabla definitiva)

| Rama git | Supabase | Vercel scope | LOG_PROVIDER | Destino logs |
|----------|----------|--------------|--------------|--------------|
| Local dev (`next dev`) | DEV | — | `local` (tee logs/dev.log) | Archivo local |
| develop branch | DEV | Preview (develop) | `http` | Log Drain → backend |
| staging branch | STAGING | Preview (staging) | `http` | Log Drain → backend |
| main | PROD | Production | `http` | Log Drain → backend PROD |

> `LOG_PROVIDER=local` SOLO en `next dev` en tu máquina. **Nunca en Vercel** (cualquier ambiente).

### Configurar env vars de Log Drain en Vercel

```bash
# Para preview (develop + staging) — apunta al backend de dev/staging
vercel env add LOG_PROVIDER preview       # valor: http
vercel env add LOG_PROVIDER_API_URL preview  # valor: https://tu-backend-dev/logs
vercel env add LOG_PROVIDER_TOKEN preview    # valor: token-dev

# Para production
vercel env add LOG_PROVIDER production       # valor: http
vercel env add LOG_PROVIDER_API_URL production  # valor: https://tu-backend-prod/logs
vercel env add LOG_PROVIDER_TOKEN production    # valor: token-prod
```

### Verificación

```bash
# Disparar un error de prueba en staging y verificar que llega al backend
# En el dashboard del backend (Axiom/Datadog/etc.) buscar el traceId del error
# Si no aparece en ~30s: verificar el Log Drain está activo y la URL es correcta
```

**Gate de salida**: un error de prueba en staging aparece en el backend de logs con `traceId`, `archivo` y `linea`.

---

## FASE 5 — OTel: tracing agnóstico (`instrumentation.ts`)

Crear `instrumentation.ts` en la raíz de **cada app** (Next.js lo carga automáticamente):

```typescript
// instrumentation.ts
// OpenTelemetry — agnóstico de backend.
// El destino se configura via OTEL_EXPORTER_OTLP_ENDPOINT (env var).
// Backends compatibles: Grafana Tempo, Honeycomb, Datadog, Jaeger self-hosted,
// New Relic, Dynatrace — sin cambiar código, solo credenciales.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOTel } = await import('@vercel/otel');
    registerOTel({
      serviceName: process.env.SERVICE_NAME ?? process.env.NEXT_PUBLIC_PROJECT_SLUG ?? 'app',
    });
  }
}
```

Agregar a `devDependencies` de cada app:
```json
{ "@vercel/otel": "^1.0.0" }
```

Si `OTEL_EXPORTER_OTLP_ENDPOINT` no está configurada, OTel corre en modo no-op (sin overhead, sin errores). Configurar en Vercel cuando se elija el backend.

---

## FASE 6 — Web Vitals RUM

En `apps/app/src/app/layout.tsx` (o la app principal), agregar un componente cliente de métricas:

```typescript
// src/components/web-vitals.tsx
'use client';
import { useReportWebVitals } from 'next/navigation';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Envía a endpoint propio — agnóstico de backend
    if (process.env.NODE_ENV === 'production') {
      navigator.sendBeacon('/api/vitals', JSON.stringify({
        name:  metric.name,
        value: metric.value,
        id:    metric.id,
        page:  window.location.pathname,
      }));
    }
  });
  return null;
}
```

```typescript
// src/app/api/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { agenticLogger } from '@/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const metric = await req.json();
    // Emite al mismo stream de logs estructurados — el Log Drain lo captura
    agenticLogger.info(
      { traceId: 'vitals', contexto: 'web-vitals:rum' },
      JSON.stringify(metric)
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
```

Agregar `<WebVitals />` al layout raíz (es cliente, sin SSR cost):
```typescript
// apps/app/src/app/layout.tsx
import { WebVitals } from '@/components/web-vitals';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
          <Toaster />
          <WebVitals />
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

## FASE 7 — Health endpoint

Si no existe ya (FASE 3.6 de `alyp-new-project` lo crea), verificar que existe:

```typescript
// src/app/api/health/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const supabase = await createClient();
    await supabase.from('organizations').select('id').limit(1);
    return NextResponse.json({
      status: 'ok',
      latency_ms: Date.now() - start,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      error: String(err),
      ts: new Date().toISOString(),
    }, { status: 503 });
  }
}
```

---

## FASE 8 — Variables de entorno

Agregar/verificar en `.env.example` y en Vercel:

```bash
# Identidad del servicio
SERVICE_NAME=$PROJECT_SLUG
LOG_LEVEL=info                  # debug | info | warn | error

# Honeypot — directorios de TU código (ajustar para monorepo)
APP_SOURCE_DIRS=src,app,pages,lib,server,components,utils,actions,services,packages

# Claves sensibles extra a redactar (se suman a las por defecto)
# LOG_REDACT_KEYS=password,token,cedula,salario

# Extractor agent-gps
LOG_PROVIDER=local              # local | axiom | http
LOG_LOCAL_FILE=logs/dev.log     # solo para LOG_PROVIDER=local
LOG_PROVIDER_API_URL=           # endpoint del backend elegido
LOG_PROVIDER_TOKEN=             # token del backend
LOG_DATASET=                    # nombre del dataset/index (Axiom, etc.)

# OTel — backend agnóstico
OTEL_EXPORTER_OTLP_ENDPOINT=   # https://... (Grafana, Honeycomb, Datadog, Jaeger...)
OTEL_EXPORTER_OTLP_HEADERS=    # Authorization=Bearer xxx
```

En Vercel, configurar por entorno:
- `preview + development` → `LOG_PROVIDER=local` o backend de dev
- `production` → `LOG_PROVIDER=axiom|http` con credenciales del backend elegido

### Mapa de configuración por ambiente

```bash
# === DESARROLLO LOCAL (next dev) ===
SERVICE_NAME=$PROJECT_SLUG-local
LOG_LEVEL=debug
LOG_PROVIDER=local
LOG_LOCAL_FILE=logs/dev.log
OTEL_EXPORTER_OTLP_ENDPOINT=   # vacío — no-op

# === VERCEL PREVIEW / DEVELOP BRANCH ===
SERVICE_NAME=$PROJECT_SLUG-dev
LOG_LEVEL=info
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=https://tu-backend-dev/logs
LOG_PROVIDER_TOKEN=token-dev
OTEL_EXPORTER_OTLP_ENDPOINT=   # opcional en dev

# === VERCEL PREVIEW / STAGING BRANCH ===
SERVICE_NAME=$PROJECT_SLUG-staging
LOG_LEVEL=info
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=https://tu-backend-staging/logs
LOG_PROVIDER_TOKEN=token-staging
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-backend/otlp  # activar en staging

# === VERCEL PRODUCTION ===
SERVICE_NAME=$PROJECT_SLUG
LOG_LEVEL=warn   # solo warn + error en prod para reducir ruido y costo
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=https://tu-backend-prod/logs
LOG_PROVIDER_TOKEN=token-prod
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-backend/otlp
```

---

## FASE 9 — ESLint: enforce logging

Fusionar en el config de ESLint del proyecto (o crear `.eslintrc.agentic.cjs` si no existe):

```javascript
// .eslintrc.agentic.cjs — reglas de logging
module.exports = {
  rules: {
    // Prohibir console.* para errores — usar agenticLogger
    'no-console': ['warn', { allow: [] }],
    // Prohibir catch vacíos — todo error debe loggearse
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
};
```

---

## FASE 10 — Workflow CI

Crear `.github/workflows/agentic-logging.yml`:

```yaml
name: Agentic Logging Audit

on:
  pull_request:
    paths:
      - '**/*.ts'
      - '**/*.tsx'
      - '**/*.js'

jobs:
  audit:
    name: Logging Standards Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Verificar que no hay console.* sin wrapper
      - name: Check for naked console calls
        run: |
          FOUND=$(grep -rn "console\.\(log\|error\|warn\)" \
            --include="*.ts" --include="*.tsx" \
            --exclude-dir=node_modules \
            --exclude-dir=.next \
            --exclude="logger.ts" || true)
          if [ -n "$FOUND" ]; then
            echo "::warning::console.* encontrados — usar agenticLogger:"
            echo "$FOUND"
          fi

      # Verificar que no hay catch vacíos
      - name: Check for empty catch blocks
        run: |
          FOUND=$(grep -rn "catch\s*([^)]*)\s*{\s*}" \
            --include="*.ts" --include="*.tsx" \
            --exclude-dir=node_modules || true)
          if [ -n "$FOUND" ]; then
            echo "::error::catch vacíos encontrados — todo error debe loggearse:"
            echo "$FOUND"
            exit 1
          fi
```

---

## FASE 11 — Protocolo de debugging para Claude Code

Anexar al `CLAUDE.md` del proyecto (en la sección `<!-- MANUAL -->`):

```markdown
## Logging y debugging (protocolo autónomo)

Este proyecto usa el **Agentic-First Logging Standard**. Los errores son JSON
con la ubicación exacta en el código. NO adivines ni explores a ciegas.

### Reglas para escribir código
1. Todo error → `agenticLogger.error(ctx, error)` desde `utils/logger.ts`.
   Nunca `console.log/console.error`, nunca `catch {}` vacío.
2. `ctx` siempre incluye `traceId` y `contexto` (operación de negocio).
   Usar `crearLoggerDeRuta(nuevoTraceId(), 'dominio:operacion', { meta })`.
3. Asignar `codigo` UPPER_SNAKE de `utils/error-codes.ts`.
   Para errores Supabase: `mapearCodigoPostgres((err as any).code)`.

### Cuando hay un error o un traceId que diagnosticar
1. Ejecutar: `npm run agent:gps <TRACE_ID>`
2. Leer el bloque `<<<AGENT_GPS_JSON>>>`: trae `archivo`, `linea`, `funcion`,
   `codigo`, `mensaje` y `contexto`.
3. Abrir **solo** ese `archivo` en esa `linea`, analizar y aplicar el fix.

### Fuentes de logs (env LOG_PROVIDER)
- `local` (dev): lee `logs/dev.log`. Correr con: `next dev | tee logs/dev.log`
- `axiom` / `http` (prod): requiere `LOG_PROVIDER_API_URL` + `LOG_PROVIDER_TOKEN`

### Casos especiales de debugging

**RLS silencioso (0 filas sin error)**:
- Síntoma: query sin error pero datos vacíos inesperadamente
- No hay `traceId` porque no lanzó excepción
- Buscar en logs el warning `query retornó vacío — verificar RLS policy`
- Ir a Supabase Studio → SQL Editor y ejecutar la query con el JWT del usuario afectado
- Verificar `pg_policies` para la tabla y `memberships` para el usuario

**Edge Runtime crashes**:
- Si el error ocurre en middleware (`middleware.ts`), el stack puede apuntar al edge runtime
- El `agenticLogger` con honeypot usa APIs de Node — no instalar en `middleware.ts`
- En middleware: usar solo `console.error` como último recurso o estructurar manualmente

### Nota de producción
`ubicacion_exacta` solo apunta a tu código si los **source maps del servidor**
están habilitados en el deploy. Activarlos en `next.config.ts`:
`serverExternalPackages` + `productionBrowserSourceMaps: true`.
```

---

## FASE 12 — Dev local: piping de logs

Para que `agent:gps` funcione en local, arrancar el servidor con piping:

```bash
# Agregar a package.json de la app o al turbo dev
"dev:log": "next dev | tee logs/dev.log"
```

Agregar `logs/` a `.gitignore`.

---

## Esquema de log de error (contrato)

```jsonc
{
  "nivel": "error",
  "servicio": "mi-proyecto",
  "env": "production",
  "release": "a1b2c3d",
  "timestamp": "2026-05-29T10:30:00.000Z",
  "traceId": "tr_12345",
  "contexto": "inventario:descontar-stock",
  "metadata": { "sku": "ABC-1", "userId": "usr_9" },
  "error": {
    "mensaje": "new row violates row-level security policy",
    "codigo": "REGLA_RLS_VIOLADA",
    "ubicacion_exacta": "at descontarStock (/app/src/lib/inventario.ts:42:11)",
    "archivo": "/app/src/lib/inventario.ts",
    "linea": 42,
    "columna": 11,
    "funcion": "descontarStock",
    "stack_snippet": ["Error: ...", "at descontarStock (...)"]
  }
}
```

---

## Patrón de uso en Server Actions y Route Handlers

```typescript
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';

export async function descontarStock(sku: string, cantidad: number) {
  const log = crearLoggerDeRuta(nuevoTraceId(), 'inventario:descontar-stock', { sku, cantidad });
  log.info('inicio');

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock')
      .update({ cantidad: cantidad })
      .eq('sku', sku)
      .select()
      .single();

    if (error) throw error;

    log.info('completado', { stockId: data.id });
    return data;
  } catch (err) {
    log.error(err, { codigo: mapearCodigoPostgres((err as any).code) });
    throw err;
  }
}
```

---

## Backends OTLP compatibles (sin cambiar código)

| Backend | `OTEL_EXPORTER_OTLP_ENDPOINT` | `LOG_PROVIDER` |
|---------|-------------------------------|----------------|
| Grafana Cloud | `https://otlp-gateway-*.grafana.net/otlp` | `http` |
| Honeycomb | `https://api.honeycomb.io` | `http` |
| Datadog | `https://api.datadoghq.com/api/intake/otlp` | `axiom`/`http` |
| Jaeger self-hosted | `http://jaeger:4318` | `local`/`http` |
| New Relic | `https://otlp.nr-data.net:4317` | `http` |
| Axiom | `https://api.axiom.co/v1/traces` | `axiom` |

Cambiar de backend = cambiar env vars. Cero cambios de código.

---

## Verificación (acceptance criteria)

Un error en la app debe producir:

```bash
# En stderr — JSON con traceId, contexto y ubicación en TU código:
{"nivel":"error","traceId":"tr_xxx","contexto":"checkout:pagar","error":{"archivo":"/app/src/actions/checkout.ts","linea":47,...}}

# agent:gps resuelve la ubicación:
node scripts/agent-gps.mjs tr_xxx
# → imprime <<<AGENT_GPS_JSON>>> con archivo + línea correctos

# ESLint falla en console.* naked y en catch vacíos
```

---

## Checklist de instalación

- [ ] `utils/logger.ts` creado con `agenticLogger`, `crearLoggerDeRuta`, `nuevoTraceId`
- [ ] `utils/error-codes.ts` creado con `CODIGOS` y `mapearCodigoPostgres`
- [ ] `scripts/agent-gps.mjs` creado y `"agent:gps"` en `package.json`
- [ ] `logs/` en `.gitignore`
- [ ] `instrumentation.ts` en cada app con `registerOTel`
- [ ] `@vercel/otel` en devDependencies
- [ ] Web Vitals: `WebVitals` component + `/api/vitals` endpoint
- [ ] `/api/health` retorna `{ status: "ok" }` con latencia
- [ ] Variables de entorno en `.env.example` y Vercel
- [ ] `SERVICE_NAME` configurado por entorno en Vercel
- [ ] ESLint: `no-console` + `no-empty` habilitados
- [ ] CI workflow `agentic-logging.yml` commiteado
- [ ] Protocolo de debugging anexado al `CLAUDE.md` del proyecto
- [ ] `next dev | tee logs/dev.log` como comando de dev local
- [ ] Prueba: lanzar un error intencional → verificar JSON en stderr con `archivo`+`linea` correctos
- [ ] Prueba: `npm run agent:gps <traceId>` → imprime `<<<AGENT_GPS_JSON>>>` con ubicación correcta
- [ ] **Prod**: source maps del servidor habilitados (sin esto, `ubicacion_exacta` apunta a `.next/` compilado)
- [ ] Log Drain configurado en Vercel para staging y production
- [ ] LOG_PROVIDER=local NUNCA en Vercel — solo para next dev local
- [ ] Env vars de LOG_PROVIDER configuradas por git branch en Vercel
- [ ] Mapa de ambientes documentado: rama→Supabase→LOG_PROVIDER→backend
- [ ] Patrón de RLS silencioso implementado en queries críticas
- [ ] Prueba de Log Drain: error de prueba visible en backend en < 30s
