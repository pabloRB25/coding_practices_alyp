# Estrategia de Ambientes

## Modelo de 3 ambientes reales

Alyp Studio usa 3 ambientes físicamente separados (no solo configuraciones distintas):

```
develop branch ──► Supabase DEV     ──► Vercel Preview (develop)
staging branch ──► Supabase STAGING ──► Vercel Preview (staging) ← branch-specific
main branch    ──► Supabase PROD    ──► Vercel Production
```

Cada ambiente tiene su propio Supabase — staging NO comparte base de datos con develop. Esto permite validar migraciones contra un estado limpio antes de promover a producción.

---

## Por qué 3 Supabase (no 2)

El modelo original de "1 Supabase DEV para develop+staging" tiene un problema crítico: staging es la última línea de defensa antes de producción. Si staging comparte base de datos con develop:

- Una migración rota en develop contamina la validación de staging
- Staging no puede validar el impacto real de una migración nueva
- Un dev rompiendo develop rompe la demo de staging

Con 3 Supabase separados, staging es un pre-prod real que solo recibe cambios de develop que ya pasaron el CI.

---

## Nomenclatura de proyectos Supabase

```
$PROJECT_SLUG-dev      → ambiente de desarrollo activo
$PROJECT_SLUG-staging  → pre-producción y validación QA
$PROJECT_SLUG-prod     → producción
```

---

## Configuración de Vercel por git branch

Vercel permite env vars específicas por rama en el scope de "Preview". Esto permite que staging tenga su propia Supabase sin crear un scope adicional:

```
Vercel env var scope:
  development              → máquina local (next dev)
  preview (default)        → todas las ramas de preview
  preview (branch: develop) → solo la rama develop
  preview (branch: staging) → solo la rama staging ← usar aquí
  production               → rama main
```

Configurar vía API:
```bash
# Env vars específicas para staging
vercel env add NEXT_PUBLIC_SUPABASE_URL \
  --git-branch staging \
  --environment preview \
  # valor: URL del Supabase STAGING
```

---

## LOG_PROVIDER por ambiente

| Ambiente | Valor | Razón |
|----------|-------|-------|
| `next dev` local | `local` | Lee `logs/dev.log` — solo funciona con filesystem local |
| develop (Vercel) | `http` | Serverless — filesystem efímero, necesita Log Drain |
| staging (Vercel) | `http` | Pre-prod real, logs deben llegar al backend |
| production | `http` | Logs críticos, deben persistir siempre |

> `LOG_PROVIDER=local` en Vercel (cualquier scope) descarta los logs silenciosamente. El filesystem de las funciones serverless es efímero y de solo lectura.

---

## Flujo de deployment — los 3 gates

Perfil next·supabase·vercel del modelo de qa-standard §Promoción entre ambientes.
Diseño: `docs/specs/2026-08-19-modelo-3-gates-design.md`.

```
Desarrollador (o agente) trabaja en feature/xxx
        │
        ▼
GATE LOCAL — `pnpm verify:full`, en la máquina. NO bloquea.
  - typecheck + lint + tests + build
  - E2E P0+P1 con los 3 oráculos contra Supabase DEV (namespace QA)
  - Mismo set exacto que el Gate STG: existe para que el fallo aparezca
    en ~6 min acá y no en ~15 min en el PR (code-standard I2).
  - Docker (`supabase start`) es OPCIONAL: apuntar QA_SUPABASE_DB_URL a
    localhost:54322 si se prefiere trabajar aislado.
        │
        ▼
PR → develop
  - Gate DEV (~4 min): verify + build. NO bloqueante — red mínima para que
    develop no acumule roto entre promociones.
  - Vercel deploy: Preview (develop branch) → Supabase DEV
        │
        ▼
PR → staging  ·  GATE STG — BLOQUEANTE (~12-15 min)
  - verify + build + pnpm audit --audit-level=high
  - Esquema desde vacío: las migraciones se aplican sobre un Postgres limpio
    del runner. Aplicarlas sobre una base que ya las tiene no prueba nada.
  - E2E P0+P1 con los 3 oráculos contra Supabase DEV (namespace QA)
  - Serializado por repo: el namespace QA de DEV es compartido.
  - Check requerido: `Gate STG`
  - Vercel deploy: Preview (staging branch) → Supabase STAGING
  - Migraciones aplicadas manualmente a STAGING:
    supabase db push --db-url $DIRECT_URL_STAGING
        │
        ▼
PR → main  ·  GATE MAIN — BLOQUEANTE (~5 min)
  - verify + build
  - Smoke P0 SOLO LECTURA contra el deploy real de staging: no re-valida el
    código (no cambió), valida el AMBIENTE — datos, env vars, esquema.
  - Check requerido: `Gate MAIN` + 1 approval + enforce_admins
  - Vercel deploy: Production → Supabase PROD
  - Migraciones aplicadas ANTES del merge:
    supabase db push --db-url $DIRECT_URL_PROD
```

> El nombre del check (`Gate STG` / `Gate MAIN`) es parte del contrato de
> bloqueo. Si el job se renombra y la branch protection no, el check requerido
> deja de reportar: el PR queda esperando para siempre, que **no** es lo mismo
> que pasar. Se cambian juntos, en el mismo PR.

---

## Migraciones: orden crítico

Las migraciones NO se aplican automáticamente al hacer deploy en Vercel. El orden correcto es:

```
1. Aplicar migración a STAGING
   supabase db push --db-url $DIRECT_URL_STAGING

2. Validar que la app funciona en staging
   → abrir URL de preview de staging
   → verificar /api/health

3. Merge PR a main

4. Aplicar migración a PROD (ANTES de que el deploy de Vercel llegue)
   supabase db push --db-url $DIRECT_URL_PROD

5. Vercel deploy a production se completa
```

> Si el deploy de Vercel llega antes que la migración: el código nuevo intentará
> acceder a una tabla que no existe. Aplicar la migración primero siempre.

---

## Supabase Branching (alternativa avanzada)

Para proyectos con alta frecuencia de cambios de schema, Supabase ofrece "branching" — una rama de base de datos por cada branch de git. El MCP de Supabase soporta esto:

```
mcp__plugin_supabase_supabase__create_branch
mcp__plugin_supabase_supabase__merge_branch
mcp__plugin_supabase_supabase__delete_branch
```

Esta es una alternativa a los 3 proyectos físicos. Para proyectos que ya tienen el modelo de 3 proyectos, no es necesario migrar.

---

## Variables de entorno completas por ambiente

```bash
# ==================== DESARROLLO LOCAL (next dev) ====================
SERVICE_NAME=$PROJECT_SLUG-local
LOG_LEVEL=debug
LOG_PROVIDER=local
LOG_LOCAL_FILE=logs/dev.log
NEXT_PUBLIC_SUPABASE_URL=<DEV URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<DEV ANON>
SUPABASE_SERVICE_ROLE_KEY=<DEV SERVICE ROLE>
DATABASE_URL=<DEV POOLER 6543>
DIRECT_URL=<DEV DIRECT 5432>

# ==================== VERCEL PREVIEW / DEVELOP ====================
SERVICE_NAME=$PROJECT_SLUG-dev
LOG_LEVEL=info
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=<backend-dev/logs>
LOG_PROVIDER_TOKEN=<token-dev>
NEXT_PUBLIC_SUPABASE_URL=<DEV URL>      ← mismo que local
SUPABASE_SERVICE_ROLE_KEY=<DEV SERVICE ROLE>
OTEL_EXPORTER_OTLP_ENDPOINT=            ← vacío en dev

# ==================== VERCEL PREVIEW / STAGING ====================
SERVICE_NAME=$PROJECT_SLUG-staging
LOG_LEVEL=info
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=<backend-staging/logs>
LOG_PROVIDER_TOKEN=<token-staging>
NEXT_PUBLIC_SUPABASE_URL=<STAGING URL>  ← STAGING, no DEV
SUPABASE_SERVICE_ROLE_KEY=<STAGING SERVICE ROLE>
OTEL_EXPORTER_OTLP_ENDPOINT=<otlp-endpoint>

# ==================== VERCEL PRODUCTION ====================
SERVICE_NAME=$PROJECT_SLUG
LOG_LEVEL=warn    ← solo warn+error para reducir ruido y costo
LOG_PROVIDER=http
LOG_PROVIDER_API_URL=<backend-prod/logs>
LOG_PROVIDER_TOKEN=<token-prod>
NEXT_PUBLIC_SUPABASE_URL=<PROD URL>
SUPABASE_SERVICE_ROLE_KEY=<PROD SERVICE ROLE>
DATABASE_URL=<PROD POOLER 6543>
OTEL_EXPORTER_OTLP_ENDPOINT=<otlp-endpoint-prod>
```
