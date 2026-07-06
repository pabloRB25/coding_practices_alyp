# FASE 5 — Vercel (delegado)

> Invocar el skill `vercel:bootstrap` con este contexto:

**Tarea**: configurar proyectos Vercel para `$PROJECT_SLUG`.
- Team: `$VERCEL_TEAM_SLUG` / `$VERCEL_TEAM_ID`
- GitHub org: `alyp-studio`, repo: `$PROJECT_SLUG`
- Si `USE_TURBOREPO=true`: crear 2 proyectos (`$PROJECT_SLUG-web`, `$PROJECT_SLUG-app`)
  - `web`: rootDirectory `apps/web`, buildCommand `cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/web`
  - `app`: rootDirectory `apps/app`, buildCommand `cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/app`
- Si `USE_TURBOREPO=false`: 1 proyecto (`$PROJECT_SLUG`), root en raíz, buildCommand `pnpm run build`

> Luego invocar `vercel:env-vars` para configurar las variables por entorno:

Para `$PROJECT_SLUG-app` (o el único proyecto en modo simple):
```
NEXT_PUBLIC_SUPABASE_URL      → development: DEV | preview (branch develop/*): DEV | preview (branch staging): STAGING | production: PROD
NEXT_PUBLIC_SUPABASE_ANON_KEY → development: DEV | preview develop: DEV | preview staging: STAGING | production: PROD
SUPABASE_SERVICE_ROLE_KEY     → (mismo patrón)
DATABASE_URL                  → (mismo patrón con poolers)
LOG_PROVIDER                  → development: local | preview develop: local | preview staging: http | production: http
SERVICE_NAME                  → $PROJECT_SLUG (todos los entornos)
NEXT_PUBLIC_PROJECT_SLUG      → $PROJECT_SLUG (todos los entornos)
OTEL_EXPORTER_OTLP_ENDPOINT   → (vacío — completar con alyp-observability)
OTEL_EXPORTER_OTLP_HEADERS    → (vacío — completar con alyp-observability)
```

> Vercel permite env vars específicas por Git Branch en previews: usar "Preview (branch: staging)"
> para distinguir staging de develop sin afectar el scope general de preview.
> Configurar vía API: PATCH /v9/projects/{id}/env con gitBranch: "staging"

Desactivar SSO protection para previews:
```bash
# PATCH /v9/projects/{projectId} → { "ssoProtection": null }
# Hacer para cada proyecto
```

## 5.6 Configurar Vercel Log Drain (observabilidad en producción)

Sin Log Drain, los logs JSON de la app **no persisten en producción** — el filesystem de Vercel es efímero.

Comandos completos en [`../assets/vercel/log-drain.sh`](../assets/vercel/log-drain.sh):
- Opción A: Via Vercel Marketplace (recomendado) — Dashboard → Integrations → buscar proveedor (Axiom, Datadog, Logtail, etc.), conectar el proyecto y configurar el drain automáticamente
- Opción B: Via API (para cualquier endpoint HTTP) — POST a `https://api.vercel.com/v1/integrations/log-drains`

Variables de entorno a agregar en Vercel (para el extractor agent-gps):
```
LOG_PROVIDER_API_URL=   # endpoint del drain o backend de logs
LOG_PROVIDER_TOKEN=     # token de autenticación
LOG_DATASET=            # nombre del dataset/índice
```

> Nota: `LOG_PROVIDER=local` solo funciona en `next dev` local. En Vercel (cualquier ambiente),
> usar `http` o el proveedor específico. `local` en serverless descarta los logs.

**Gate de salida**: proyectos creados, GitHub linkeado, env vars configuradas por entorno.
