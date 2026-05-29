# Ecosistema de Skills — Arquitectura y Relaciones

## Diagrama de flujo

```
Usuario invoca /alyp-new-project
        │
        ▼
FASE 0-3A: Scaffold base
  - Repo GitHub + ramas + CODEOWNERS
  - CI con pnpm verify + branch protection + secrets
  - Turborepo / Next.js / packages/ui + database + config
  - tsconfig strict + security headers + PPR
  - utils/logger.ts + utils/error-codes.ts (stubs tipados)
  - instrumentation.ts (OTel placeholder)
  - env.ts validando todas las vars (incluye observabilidad)
        │
        ▼
FASE 3.5 ──────────────────► alyp-agentic-standards (bootstrap)
  Delega                        - TypeScript noUncheckedIndexedAccess
                                - pnpm verify gate único
                                - src/features/ architecture
                                - new-feature.mjs con migration stub
                                - Vitest + ESLint no-restricted-imports
                                - CLAUDE.md slim ← agentic-standard: v1
        │
        ▼
FASE 3.6: Data Layer
  - supabase/migrations/0001_rls_baseline.sql
  - supabase/migrations/0002_tenancy.sql (si USE_MULTITENANCY)
  - supabase/migrations/0003_auth_trigger.sql
  - supabase/seed.sql
        │
        ▼
FASE 4 ─────────────────────► supabase:supabase
  Delega                     supabase:supabase-postgres-best-practices
                                - 3 proyectos: dev / staging / prod
                                - Pooler config (DATABASE_URL + DIRECT_URL)
                                - Leaked-password protection
                                - Advisors: 0 tablas sin RLS
        │
        ▼
FASE 5 ─────────────────────► vercel:bootstrap + vercel:env-vars
  Delega                        - Proyectos Vercel creados
                                - GitHub App linkeado
                                - Env vars por git branch
                                  develop → DEV
                                  staging → STAGING
                                  main    → PROD
                                - SSO desactivado para previews
                                - Log Drain configurado (FASE 5.6)
        │
        ▼
FASE 5.5 ───────────────────► alyp-observability
  Delega                        - Reemplaza stubs con implementación completa
                                - utils/logger.ts (honeypot, PII scrub, niveles)
                                - utils/error-codes.ts (UPPER_SNAKE + mapeo PG)
                                - scripts/agent-gps.mjs (local|axiom|http)
                                - instrumentation.ts OTel completo
                                - Web Vitals → /api/vitals
                                - CLAUDE.md.append (protocolo debugging)
        │
        ▼
FASE 5.6 ───────────────────► vercel:vercel-firewall
  Delega                        - Rate limiting en /api/ y /auth/
        │
        ▼
FASE 5.7 ───────────────────► vercel:next-cache-components
  Delega                        - PPR / use cache / cacheTag
                                - Estrategia ISR para apps/web
        │
        ▼
FASE 6-8: Commit + Deploy + Docs + Auto-Context
  - Primer deploy READY
  - /api/health retorna ok
  - docs/CONFIGURACION.md
  - generate-context.js + update-context.yml
  - CONTEXT_BOT_TOKEN configurado
```

---

## Relación entre skills

### `alyp-new-project` es el orquestador, no implementa

El orquestador conoce el **orden** y el **contexto** que necesita cada skill especializado. Nunca duplica lógica que ya existe en los skills delegados.

### `alyp-observability` tiene dos responsabilidades claras

1. **Stubs → implementación**: El scaffold base crea stubs tipados de `logger.ts` y `error-codes.ts` para que el código compile desde el día 1. `alyp-observability` los reemplaza con la implementación completa (honeypot, PII scrub, etc.).

2. **Plataforma**: Configura el transporte de logs (Log Drain) y el OTel backend. El código de la app nunca cambia al cambiar de backend.

### `alyp-agentic-standards` tiene dos artefactos principales

1. **Implementación** (lo que instala): feature architecture, verify script, generador, Vitest, ESLint
2. **Referencia** (al final del archivo): la guía completa de "agentic-ready" — no se copia a los proyectos, vive una sola vez en el skill

### `agentic-logging` es standalone

Puede usarse independientemente de los demás skills para cualquier proyecto Node/TS que quiera logging GPS. No asume Turborepo ni Supabase.

---

## El patrón de stubs

```
FASE 3A (scaffold base)
  Crea: utils/logger.ts        ← stub tipado, compila, no funciona bien en prod
  Crea: utils/error-codes.ts   ← stub tipado, tiene los CODIGOS básicos

    ↓ el código ya puede importar @/utils/logger sin errores de TypeScript
    ↓ pnpm new-feature genera features que compilan
    ↓ pnpm verify pasa

FASE 5.5 (alyp-observability)
  Sobreescribe: utils/logger.ts        ← implementación completa con honeypot
  Sobreescribe: utils/error-codes.ts   ← con mapearCodigoPostgres completo
```

Este patrón resuelve el problema de "el generador de features usa símbolos de observabilidad antes de que observabilidad se instale". El stub garantiza que el código compile en cualquier orden de ejecución.

---

## Variables de sesión que fluyen entre fases

El orquestador mantiene estas variables en memoria durante la ejecución:

| Variable | Definida en | Usada en |
|----------|------------|---------|
| `PROJECT_SLUG` | FASE 1 | Todas |
| `PACKAGE_SCOPE` | FASE 1 | FASE 3A, 5 |
| `USE_TURBOREPO` | FASE 1 | FASE 3, 5, CI |
| `USE_MULTITENANCY` | FASE 1 | FASE 3.6 |
| `VERCEL_TEAM_SLUG` | FASE 1 | FASE 5 |
| `SUPABASE_DEV_URL` | FASE 4 | FASE 5, .env.local |
| `SUPABASE_STAGING_URL` | FASE 4 | FASE 5 |
| `SUPABASE_PROD_URL` | FASE 4 | FASE 5 |
| `DATABASE_URL_*` | FASE 4 | FASE 5, env.ts |

---

## Checklist de coherencia (para validar una instalación)

```bash
# 1. verify pasa limpio
pnpm verify  # → 0 errores TypeScript, 0 warnings ESLint críticos, tests verdes

# 2. Generador funciona y genera migration
pnpm new-feature test-dominio
# → crea src/features/test-dominio/ con 6 archivos
# → crea supabase/migrations/TIMESTAMP_add_test-dominio.sql con RLS

# 3. Tipos de Supabase generables
pnpm supabase:gen:local
# → src/types/database.types.ts actualizado

# 4. Health endpoint funciona
curl http://localhost:3001/api/health
# → { "status": "ok", "latency_ms": N }

# 5. Logging GPS funciona
# Lanzar un error intencional → buscar en stderr JSON con traceId
# pnpm agent:gps <traceId> → <<<AGENT_GPS_JSON>>> con archivo+línea correctos

# 6. CLAUDE.md tiene sello
grep "agentic-standard: v1" CLAUDE.md  # → debe encontrarlo

# 7. 3 Supabase proyectos activos
# supabase.com → verificar dev, staging, prod para el proyecto

# 8. Log Drain configurado
# Vercel Dashboard → Integrations → verificar drain activo para staging y prod
```
