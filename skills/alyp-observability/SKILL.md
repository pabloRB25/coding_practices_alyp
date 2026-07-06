---
name: alyp-observability
description: >
  Alyp Studio — Observabilidad y Logs. Instala o audita la capa de observabilidad
  estándar en proyectos SaaS enterprise: logging agéntico (delegado al skill
  agentic-logging), instrumentación OpenTelemetry (traces + métricas), Vercel Log
  Drains y exporters OTLP agnósticos de backend. Usar cuando el usuario pida
  "instalar observabilidad", "auditar observabilidad / logs", "configurar OTel /
  OpenTelemetry", "configurar Log Drains", "migrar desde console.log", o al
  ejecutar la FASE 5.5 de alyp-new-project.
---

# Alyp Studio — Observabilidad y Logs

**Principio rector**: instrumentar una sola vez con estándares abiertos; el backend es decisión de proyecto, no de scaffold.

```
Tu código → agenticLogger (stdout/stderr JSON)
         → OTel SDK      (traces + métricas)
         → Plataforma    (Vercel Log Drains / OTLP exporter → cualquier backend)
```

**Sin vendor lock-in en el código de la app.** Cambiar de Axiom a Datadog a Grafana = cambiar credenciales, no código.

## Cuándo usar este skill

- Scaffolding de proyecto nuevo (FASE 5.5 de `alyp-new-project`)
- Auditar un proyecto existente que usa `console.log/console.error`
- Migrar desde un logger con dependencias a uno agnóstico

## FASE 1 — Detectar contexto

```bash
ls apps/ packages/ src/ 2>/dev/null
cat package.json | grep -E '"name"|"packageManager"'
test -f turbo.json && echo "TURBOREPO" || echo "SIMPLE"
```

Anotar:
- `IS_MONOREPO` — true si existe `turbo.json`/`pnpm-workspace.yaml`
- `APP_DIRS` — rutas de las apps (ej: `apps/app`, `apps/web` o `src`)
- `UTILS_DIR` — dónde van los utilitarios (ej: `apps/app/src/utils` o `src/utils`)

## FASE 2 — Capa de logging: invocar el skill `agentic-logging`

Toda la capa de logging (las 3 Reglas de Oro, `utils/logger.ts`, `utils/error-codes.ts`,
`scripts/agent-gps.mjs`, ESLint, workflow CI, protocolo de debugging en `CLAUDE.md`,
claves `.env`) la instala el skill **`agentic-logging`** — invocalo ahora y completalo
antes de seguir con las fases de este skill. No dupliques ni reescribas ese código aquí.

## FASE 3 — Vercel Log Drain (transporte en producción)

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

**Gate de salida**: un error de prueba en staging aparece en el backend de logs con `traceId`, `archivo` y `linea` en menos de ~30s.

## FASE 4 — OTel: tracing agnóstico (`instrumentation.ts`)

Copiar **verbatim** el asset de este skill a la raíz de **cada app** (Next.js lo carga automáticamente):

```bash
cp ~/.claude/skills/alyp-observability/assets/instrumentation.ts <app>/instrumentation.ts
```

Agregar a `devDependencies` de cada app:
```json
{ "@vercel/otel": "^1.0.0" }
```

Si `OTEL_EXPORTER_OTLP_ENDPOINT` no está configurada, OTel corre en modo no-op (sin overhead, sin errores). Configurar en Vercel cuando se elija el backend.

## FASE 5 — Variables de entorno OTel por ambiente

Las claves base del logger/extractor las instala `agentic-logging` (su `assets/env.example`).
Aquí solo se configuran los exporters por ambiente:

```bash
# === DESARROLLO LOCAL (next dev) ===
SERVICE_NAME=$PROJECT_SLUG-local
LOG_LEVEL=debug
LOG_PROVIDER=local
OTEL_EXPORTER_OTLP_ENDPOINT=   # vacío — no-op

# === VERCEL PREVIEW / DEVELOP BRANCH ===
SERVICE_NAME=$PROJECT_SLUG-dev
LOG_PROVIDER=http
OTEL_EXPORTER_OTLP_ENDPOINT=   # opcional en dev

# === VERCEL PREVIEW / STAGING BRANCH ===
SERVICE_NAME=$PROJECT_SLUG-staging
LOG_PROVIDER=http
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-backend/otlp  # activar en staging

# === VERCEL PRODUCTION ===
SERVICE_NAME=$PROJECT_SLUG
LOG_LEVEL=warn   # solo warn + error en prod para reducir ruido y costo
LOG_PROVIDER=http
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-backend/otlp
```

`OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xxx` cuando el backend lo requiera.

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

### Grafana Cloud + Loki — configuración específica (gotchas críticos)

Grafana Cloud expone **dos instancias completamente separadas**: (1) OTel/Grafana (ID `xxxxxx`, endpoint `otlp-gateway-prod-*.grafana.net`) y (2) Hosted Logs/Loki (ID distinto, URL visible en Cloud Portal → Hosted Logs → Instance Details, típicamente `logs-prod-042.grafana.net`). El token OTel **no funciona** para Loki.

**Vars requeridas para Loki** (4 en total — configurar en Vercel Production + Preview via REST API si el CLI falla):

```bash
LOKI_PUSH_URL="https://logs-prod-042.grafana.net/loki/api/v1/push"   # URL del portal Hosted Logs
LOKI_AUTH="Basic <base64('HOSTED_LOGS_ID:TOKEN')>"                    # HOSTED_LOGS_ID ≠ OTel ID
LOG_PROVIDER_API_URL="https://logs-prod-042.grafana.net/loki/api/v1/query_range"
LOG_PROVIDER_TOKEN="Basic <base64('HOSTED_LOGS_ID:TOKEN')>"           # mismo valor que LOKI_AUTH
```

**Requisitos del token (Access Policy)**: el token debe tener `logs:write` (para push desde `logs-proxy`) Y `logs:read` (para que `agent:gps` pueda consultar). El token OTLP-write por defecto solo tiene `logs:write`.

**`agent:gps:prod` local**: añadir a `package.json` el script `"agent:gps:prod": "node --env-file=.env.production.local scripts/agent-gps.mjs"` y crear `.env.production.local` via `vercel env pull` (corregir manualmente los valores cifrados que aparecen como `""`).

**Vercel CLI bug v53.x**: `vercel env add KEY preview --value ... --yes` falla con código 1. Usar REST API: `POST https://api.vercel.com/v10/projects/{projectId}/env?teamId={teamId}` con body `{"key":"...","value":"...","type":"encrypted","target":["production","preview"]}`.

## Checklist de instalación

- [ ] Skill `agentic-logging` ejecutado completo (logger, error-codes, agent-gps, ESLint, CI, CLAUDE.md, env)
- [ ] `instrumentation.ts` en cada app (copiado verbatim de `assets/`) con `registerOTel`
- [ ] `@vercel/otel` en devDependencies
- [ ] Log Drain configurado en Vercel para staging y production
- [ ] `LOG_PROVIDER=local` NUNCA en Vercel — solo para `next dev` local
- [ ] Env vars de `LOG_PROVIDER` y `OTEL_EXPORTER_OTLP_ENDPOINT` configuradas por git branch en Vercel
- [ ] `SERVICE_NAME` configurado por entorno en Vercel
- [ ] Mapa de ambientes documentado: rama→Supabase→LOG_PROVIDER→backend
- [ ] Prueba de Log Drain: error de prueba visible en backend en < 30s
