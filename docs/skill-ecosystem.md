# Ecosistema de Skills — Arquitectura y Relaciones

Este documento cubre los 7 skills del ecosistema, cómo se delegan entre sí, y el
ciclo operativo completo (planificar → implementar → verificar → probar →
observar → curar) que atraviesan. Para instalación ver
[`installation.md`](./installation.md); para qué adopta un equipo y en qué
orden ver [`adopcion-equipos.md`](./adopcion-equipos.md).

---

## Diagrama de flujo — creación de un proyecto nuevo

```
Usuario invoca alyp-new-project
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
        │
        ▼
FASE 5.5 ───────────────────► alyp-observability
  Delega                        - agentic-logging (implementación completa)
                                - utils/logger.ts (honeypot, PII scrub, niveles)
                                - utils/error-codes.ts (UPPER_SNAKE + mapeo PG)
                                - scripts/agent-gps.mjs (local|axiom|http)
                                - instrumentation.ts OTel completo
                                - Web Vitals → /api/vitals
                                - Log Drain configurado
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
FASE 5.8 ───────────────────► alyp-qa-standard
  Delega                        - Scaffold de qa/ (catálogo YAML de flujos)
                                - Playwright E2E con oráculos UI+DB+logs
                                - Smoke agéntico post-deploy
        │
        ▼
FASE 6-8: Commit + Deploy + Docs + Auto-Context
  - Primer deploy READY
  - /api/health retorna ok
  - docs/CONFIGURACION.md
  - generate-context.js + update-context.yml
  - CONTEXT_BOT_TOKEN configurado
```

**Transversales, no ligados a una fase**: `devstral-orchestration` (decide QUIÉN
ejecuta cada paso — qué tier de modelo, local vs. cloud) y `alyp-maestro`
(curaduría de conocimiento, se invoca al cerrar una feature o tarea, no durante
el scaffold inicial).

---

## Los 7 skills y su cadena de delegación

### `alyp-new-project` — orquestador, no implementa

Conoce el **orden** y el **contexto** que necesita cada skill especializado.
Nunca duplica lógica que ya existe en los skills delegados. Su `requires:`
declara la dependencia explícita: `[alyp-agentic-standards, alyp-observability,
alyp-qa-standard]`.

Delegación por fase:
- **F3.5 → `alyp-agentic-standards`**: arquitectura por features y gate de verificación.
- **F4 → `supabase:supabase`** (+ `supabase:supabase-postgres-best-practices`): infra de datos.
- **F5, F5.6, F5.7 → `vercel:*`** (`bootstrap`, `vercel-firewall`, `next-cache-components`): infra de despliegue, rate limiting, cache.
- **F5.5 → `alyp-observability`**, que a su vez invoca `agentic-logging` para la implementación de logging (ver abajo).
- **F5.8 → `alyp-qa-standard`**: la última pieza antes de cerrar el scaffold — necesita que exista código con logging (F5.5) y arquitectura (F3.5) para tener algo que probar.

### `alyp-agentic-standards` — código legible por agentes

Implementa el contrato `code-standard`. `requires: [agentic-logging]` — el
gate `pnpm verify` y el invariante I8 (errores estructurados) dependen de que
exista el `traceid-contract`. Dos modos: `bootstrap` (proyecto nuevo) y `audit`
(proyecto existente, integra sin romper).

Dos artefactos en el propio skill: la **implementación** (lo que instala:
feature architecture, generador, Vitest, ESLint) y la **referencia** (la guía
completa de "agentic-ready" al final del archivo — no se copia a los
proyectos, vive una sola vez en el skill).

### `agentic-logging` — logging GPS, standalone y base de todo

`provides: [logging-standard, traceid-contract]`, sin `requires:` propios — es
la base de la cadena. Puede usarse independientemente de los demás skills para
cualquier proyecto Node/TS que quiera logging GPS, sin asumir Turborepo ni
Supabase. `alyp-agentic-standards`, `alyp-observability` y `alyp-qa-standard`
dependen (directa o transitivamente) de él.

### `alyp-observability` — logging GPS completo + OTel + Log Drains

`requires: [agentic-logging]`. Dos responsabilidades:
1. **Stubs → implementación**: el scaffold base (F3A) crea stubs tipados de
   `logger.ts` y `error-codes.ts` para que el código compile desde el día 1;
   `alyp-observability` los reemplaza con la implementación completa
   (honeypot, PII scrub, etc.) delegando en `agentic-logging`.
2. **Plataforma**: configura el transporte (Log Drain) y el backend OTel. El
   código de la app nunca cambia al cambiar de backend.

### `alyp-qa-standard` — consumidor del `traceid-contract`

`requires: [traceid-contract]`, `provides: [qa-standard]`. Es el consumidor
final de la cadena logging: su tercer oráculo (de tres: UI + persistencia +
logs) verifica "cero entradas `nivel: error` para el `traceId` de la corrida" —
una aserción mecánica que solo es posible porque `agentic-logging` ya garantiza
que todo error comparte un `traceId` consultable. Sin logging estructurado en
pie, el oráculo de logs de QA no tiene nada que auditar.

### `devstral-orchestration` — transversal, decide quién ejecuta

No participa de la cadena de fases del scaffold: es el protocolo que decide,
en cualquier punto del ciclo (planificar, implementar, revisar), qué tier de
modelo ejecuta cada bloque de trabajo — desde el orquestador (juez) hasta el
ejecutor local mecánico. `provides: [orchestration]`, sin `requires:` — es
agnóstico del resto del ecosistema y aplica a cualquier tarea, no solo a
scaffolding de proyectos SaaS.

### `alyp-maestro` — cierra el ciclo

`provides: [curaduria]`, sin `requires:`. Se invoca al cerrar una feature o
tarea (no durante el scaffold inicial): destila lo aprendido — metodologías,
pitfalls, decisiones durables — en skills locales versionadas dentro del repo
cliente (`.claude/skills/<nombre>/SKILL.md`), que Claude auto-carga en futuras
sesiones de ese proyecto puntual. Complementa a engram (recall de hechos) sin
duplicarlo. Incluye la skill fija `planificar`, que es el punto de entrada del
ciclo operativo (siguiente sección).

---

## El patrón de stubs

```
FASE 3A (scaffold base)
  Crea: utils/logger.ts        ← stub tipado, compila, no funciona bien en prod
  Crea: utils/error-codes.ts   ← stub tipado, tiene los CODIGOS básicos

    ↓ el código ya puede importar @/utils/logger sin errores de TypeScript
    ↓ pnpm new-feature genera features que compilan
    ↓ pnpm verify pasa

FASE 5.5 (alyp-observability, vía agentic-logging)
  Sobreescribe: utils/logger.ts        ← implementación completa con honeypot
  Sobreescribe: utils/error-codes.ts   ← con mapearCodigoPostgres completo
```

Este patrón resuelve el problema de "el generador de features usa símbolos de
observabilidad antes de que observabilidad se instale". El stub garantiza que
el código compile en cualquier orden de ejecución.

---

## Ciclo operativo

Una vez que el ecosistema está instalado y un proyecto arrancado, el trabajo
del día a día recorre un ciclo de 6 pasos que vuelve sobre sí mismo:

```
   ┌─────────────► planificar
   │              (alyp-maestro: skill "planificar" — descompone la tarea)
   │                      │
   │                      ▼
  curar                implementar
(alyp-maestro:      (alyp-new-project para scaffold nuevo;
 destila lo           alyp-agentic-standards para features
 aprendido en          en proyecto existente, modo audit)
 skills locales)              │
   │                      ▼
   │                  verificar
   │              (gate único: pnpm verify — I2/I3 de code-standard;
   │               evidencia = contracts/evidencia.schema.json)
   │                      │
   │                      ▼
   │                   probar
   │              (alyp-qa-standard: 3 oráculos — UI + DB + logs;
   │               veredicto.json por corrida)
   │                      │
   │                      ▼
   └──────────────── observar
              (agent-gps / traceId: cuando algo falla en runtime,
               agentic-logging + alyp-observability dan la ubicación
               exacta — archivo + línea — sin leer el código fuente)
```

- **Planificar**: `alyp-maestro` incluye la skill fija `planificar`, punto de
  entrada del ciclo — descompone la tarea antes de tocar código.
- **Implementar**: scaffold completo vía `alyp-new-project` (proyecto nuevo) o
  incremental vía `alyp-agentic-standards` en modo `audit` (proyecto existente).
- **Verificar**: el gate único (`pnpm verify`) es el invariante I2 de
  `code-standard` — un comando, espejado en CI, que debe pasar limpio antes de
  considerar algo terminado (I3: done = gate + evidencia).
- **Probar**: `alyp-qa-standard` ejercita los flujos de negocio del catálogo con
  sus tres oráculos; el oráculo de logs es el punto donde `qa-standard` consume
  el `traceid-contract` de `agentic-logging`.
- **Observar**: cuando algo falla — en dev o en producción — `agent-gps`
  (instalado por `alyp-observability`) traduce un `traceId` a archivo+línea
  exactos, sin que el agente tenga que leer el código para ubicar el error.
- **Curar**: al cerrar la feature o tarea, `alyp-maestro` destila lo aprendido
  (metodologías, pitfalls, decisiones) en skills locales del repo cliente, que
  se auto-cargan en la próxima sesión — y el ciclo vuelve a **planificar** con
  ese conocimiento ya disponible.

`devstral-orchestration` es transversal a los 6 pasos: en cada uno, decide qué
tier de modelo ejecuta el trabajo (orquestador, razonador, obrero, barato,
mecánico, o QA automático), no es un paso aparte del ciclo.

---

## Variables de sesión que fluyen entre fases (scaffold de proyecto nuevo)

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

# 9. QA de flujos corre y produce veredicto
# ver skills/alyp-qa-standard/ → catálogo YAML + veredicto.json por corrida

# 10. Lint estructural del ecosistema (a nivel de este repo, no del proyecto cliente)
node scripts/lint-skills.mjs
# → ✓ lint-skills: 7 skills OK (N capacidades)
```
