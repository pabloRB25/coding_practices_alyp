---
name: alyp-new-project
version: 1.1.0
requires: [alyp-agentic-standards, alyp-observability, alyp-qa-standard]
description: >
  Alyp Studio — New Project Setup. Orquestador para crear proyectos SaaS enterprise
  con el stack Turborepo · Next.js (última estable) · Supabase · Vercel · GitHub.
  Usar cuando el usuario pida "nuevo proyecto", "crear proyecto nuevo Alyp/SaaS",
  "scaffolding enterprise", "inicializar repo con stack Turborepo+Next+Supabase+Vercel",
  "setup de proyecto para cliente", o cualquier creación de plataforma SaaS de Alyp Studio
  desde cero (repo GitHub + CI + Supabase multi-ambiente + Vercel + observabilidad).
---

# Alyp Studio — New Project Setup

Skill orquestador para crear proyectos SaaS enterprise con el stack de Alyp Studio.
Delega fases especializadas a skills dedicados — no reinventa lo que ya está resuelto.

**Stack**: Turborepo · Next.js (última estable) · Supabase · Vercel · GitHub
**Principio**: agnóstico por defecto — toda integración de plataforma vía env var estándar o protocolo abierto (OTel, OTLP).

Ejecuta cada fase en orden. Anuncia el inicio de cada fase. Si algo falla, diagnostica antes de continuar.
Cada fase tiene su detalle completo en `references/fase-NN-<nombre>.md` — leer el archivo de la fase ANTES de ejecutarla. Los bloques de código/config largos están en `assets/` y se copian tal cual (sustituyendo placeholders `$PROJECT_SLUG`, `$PACKAGE_SCOPE`, `$CLIENT_NAME`, `<NEXT_VERSION>`).

## Decisiones que requieren input del usuario (FASE 1)

1. **Variables del proyecto**: `PROJECT_SLUG`, `PACKAGE_SCOPE`, `CLIENT_NAME`, `VERCEL_TEAM_SLUG`, `VERCEL_TEAM_ID`, `GITHUB_ORG` (siempre `alyp-studio`), `BASE_DIR`.
2. **`USE_TURBOREPO`** (true/false): true si hay 2+ apps o segunda app planeada en < 6 meses. Gobierna FASE 3, FASE 5 y el CI.
3. **`USE_MULTITENANCY`** (true/false): true si el SaaS tiene organizaciones/equipos/cuentas empresa. Controla FASE 3.5 (migraciones de tenancy).

**Criterio general:** Si dudás, actuá directo. No avances de fase si su gate de salida falla.

**Las decisiones 2 y 3 (`USE_TURBOREPO`, `USE_MULTITENANCY`) son decisiones de
arquitectura de una vía** (baseline §02, regla de reversibilidad): cada una
produce su ADR fundacional en `docs/adr/` del proyecto nuevo (0001-monorepo,
0002-tenancy), con el formato del skill `architecture-standards`. Si el
proyecto nace con un componente con forma legítima de servicio (escalado
propio, equipo autónomo, límite duro), la separación se decide acá y deja ADR
— no se difiere a una reescritura futura.

**Frontera con `agentic-project-plan-exec-v1`**: ese skill genera la capa de
context-docs para agentes (AGENTS.md/CLAUDE.md/context/); este skill genera la
plataforma (repo+CI+Supabase+Vercel). En un proyecto nuevo Alyp corre PRIMERO
este skill; los context-docs se completan con plan-exec si el cliente los pide.
Ninguno reescribe el output del otro.

---

## Índice de FASES

### FASE 0 — Pre-flight → `references/fase-00-preflight.md`
**Objetivo**: verificar herramientas y autenticación. **Fallar rápido** antes de crear recursos.
**Pasos clave**: versiones de `gh`, `vercel`, `pnpm >= 9`, `node >= 22`, `supabase`; `gh auth status` (scopes repo + admin:org); `vercel whoami`; identidad git (pablopr / pr@pablorodriguezb.com).
**Gate — no avances si falla**: todas las herramientas disponibles y autenticadas. No continuar si falla gh o vercel.

### FASE 1 — Arquitectura del proyecto → `references/fase-01-arquitectura.md`
**Objetivo**: recopilar variables y tomar las 2 decisiones de arquitectura (tablas de criterios en la referencia).
**Pasos clave**: preguntar al usuario las variables; decidir `USE_TURBOREPO` y `USE_MULTITENANCY`; anotar todo en memoria de sesión.

### FASE 2 — Repositorio GitHub → `references/fase-02-repositorio-github.md`
**Objetivo**: crear repo privado en `alyp-studio/` con ramas y CODEOWNERS.
**Pasos clave**: `gh repo create` (privado, clone, gitignore Node); ramas `develop` y `staging` pusheadas; `.github/CODEOWNERS` (archivos críticos solo @pablopr).
**Gate — no avances si falla**: repo creado, 3 ramas en origin, CODEOWNERS commiteado.

### FASE 2b — Gates de promoción + Branch Protection → `references/fase-02b-ci-branch-protection.md`
**Objetivo**: workflows antes que protección — el job debe existir en el repo ANTES de exigirlo como status check, o quedará pendiente para siempre.
**Pasos clave**: los 3 gates de qa-standard §Promoción entre ambientes — `Gate DEV` (asset `assets/ci/ci-turborepo.yml`, PR a develop, no bloquea), `Gate STG` (`assets/ci/gate-stg.yml`, PR a staging, bloquea) y `Gate MAIN` (`assets/ci/gate-main.yml`, PR a main, bloquea); los dos últimos invocan los reutilizables `qa-e2e.yml` y `smoke.yml` del skill `alyp-qa-standard`. Branch protection con `assets/ci/branch-protection.sh` (contextos `Gate STG` / `Gate MAIN` — el nombre ES el contrato de bloqueo, G4). Secrets: `CONTEXT_BOT_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF_DEV/PROD`, y los `QA_*` sin los cuales los flujos quedan skipped.
**Gate — no avances si falla**: los 3 workflows en `develop`, branch protection activa en las 3 ramas, y los contextos requeridos coincidiendo exactamente con los nombres de los jobs agregadores.

### FASE 2c — Supply-chain & seguridad del repo → assets `assets/github-supply-chain/`
**Objetivo**: hardening de supply-chain "grado banca" desde el día 1 (referencia: el `.github/` open-source de Santander AI). Son assets que se copian tal cual al repo (sustituyendo `$SECURITY_EMAIL`, `$CLIENT_NAME`).
**Pasos clave**:
- `.github/workflows/secret-scan.yml` + `.github/secret-scan-allowlist.txt` — bloquea PRs que filtran secretos (claves privadas, AWS/OpenAI, `service_role` de Supabase, `.env` reales commiteados). El anon key público va en la allowlist.
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard (se activa solo al pasar el repo a público; inerte mientras es privado).
- `.github/dependabot.yml` — bumps agrupados de npm + pins SHA de las GitHub Actions (zona CR).
- `.github/SECURITY.md` — política de divulgación responsable con SLA y alcance (RLS, multi-tenancy, PII).
- Acciones pineadas a SHA en todos los workflows; Dependabot las mantiene frescas.
**Gate — no avances si falla**: `secret-scan` corre verde en `develop`; `dependabot.yml` y `SECURITY.md` commiteados. (El job de Scorecard queda inerte hasta público — esperado.)

### FASE 3 — Scaffold (3A Turborepo / 3B simple) → `references/fase-03-scaffold.md`
**Objetivo**: scaffold completo del monorepo o app simple según `USE_TURBOREPO`.
**Pasos clave**: obtener `NEXT_VERSION` con `npm show next dist-tags.latest` (nunca hardcodear — Vercel bloquea versiones vulnerables); estructura apps/ + packages/ (ui, database, config); tsconfig SIEMPRE auto-contenido por app (nunca extends de packages/config); `next.config.ts` con security headers + PPR; clientes Supabase SSR con tipos explícitos (`CookieOptions`); stubs de `logger.ts` y `error-codes.ts`; regla Edge vs Node (nunca `createAdminClient()` en middleware); middleware de auth; providers React Query + `env.ts` (t3-env); `instrumentation.ts` OTel agnóstico; layout raíz.
**Assets**: `assets/config/*` (package.json raíz/app/web/ui/simple, turbo.json, tsconfig, next.config web/app, .env.example), `assets/supabase/server-client.ts`, `assets/supabase/middleware.ts`, `assets/observability/*-stub.ts`, `assets/app/{query-provider.tsx,env.ts,layout.tsx}`.

### FASE 3.5 — Agentic-Ready Standards (delegado) → `references/fase-35-agentic-standards.md`
**Delega a**: skill `alyp-agentic-standards` en modo **bootstrap**.
**Objetivo**: tsconfig estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), scripts `verify`/`new-feature`/`supabase:gen`, `src/features/`, Vitest, ESLint con `no-restricted-imports`, `CLAUDE.md` slim con sello `agentic-standard: v1`.
**Gate — no avances si falla**: `pnpm verify` pasa limpio; `pnpm new-feature test` crea `src/features/test/` con 6 archivos; `CLAUDE.md` tiene sello de versión.

### FASE 3.6 — Data Layer & Tenancy → `references/fase-36-data-layer-tenancy.md`
**Objetivo**: RLS deny-by-default SIEMPRE; multi-tenancy solo si `USE_MULTITENANCY=true`.
**Pasos clave**: `0001_rls_baseline.sql`; si multitenancy: `0002_tenancy.sql` (organizations, memberships, audit_log, helper `auth.user_orgs()` sin recursión — asset `assets/supabase/0002_tenancy.sql`), helper `require-role.ts` (asset `assets/app/require-role.ts`), `seed.sql`, trigger `0003_auth_trigger.sql` (sin él, el primer usuario queda bloqueado por RLS — asset `assets/supabase/0003_auth_trigger.sql`).

### FASE 3.6 (bis) — App Shell & Resilience → `references/fase-36b-app-shell-resilience.md`
**Objetivo**: shell de resiliencia de la app. (Nota: en el original esta fase repite el número 3.6.)
**Pasos clave**: `error.tsx` (asset `assets/app/error.tsx`), `global-error.tsx` (idéntico, layout raíz), `not-found.tsx`, `loading.tsx`, health endpoint `/api/health`.

### FASE 4 — Supabase (delegado) → `references/fase-04-supabase.md`
**Delega a**: skill `supabase:supabase`; luego `supabase:supabase-postgres-best-practices` (pooling, índices RLS/FK de tenant, leaked-password protection).
**Pasos clave**: crear 3 proyectos (dev/staging/prod, us-east-1); anotar URLs, keys, `DATABASE_URL` (pooler 6543) y `DIRECT_URL` (5432) de cada uno; `supabase/config.toml`; `.env.local` con keys DEV (no commitear); `supabase db push` a DEV; advisors.
**Gate — no avances si falla**: 3 proyectos ACTIVE_HEALTHY, migraciones aplicadas en DEV, 0 tablas sin RLS en advisor.

### FASE 5 — Vercel (delegado) → `references/fase-05-vercel.md`
**Delega a**: skill `vercel:bootstrap`; luego `vercel:env-vars`.
**Pasos clave**: 2 proyectos (`-web`, `-app`) con turbo filter si Turborepo, 1 si simple; env vars por entorno y por git branch (develop → DEV, staging → STAGING, main → PROD); desactivar SSO protection en previews; **5.6**: Vercel Log Drain (sin él los logs no persisten — asset `assets/vercel/log-drain.sh`) + vars `LOG_PROVIDER_*`; `LOG_PROVIDER=local` solo en dev local.
**Gate — no avances si falla**: proyectos creados, GitHub linkeado, env vars configuradas por entorno.

### FASE 5.5 — Observabilidad (delegado) → `references/fase-55-observabilidad.md`
**Delega a**: skill `alyp-observability` (que a su vez invoca `agentic-logging` completo).
**Gate — no avances si falla**: checklist del skill cumplido; error de prueba en staging visible en el backend de logs en < 30 s con `traceId`, `archivo` y `linea`.

### FASE 5.6 — Rate Limiting & Seguridad de tráfico (delegado) → `references/fase-56-rate-limiting.md`
**Delega a**: skill `vercel:vercel-firewall` — proteger `/api/`, `/auth/`, Server Actions.

### FASE 5.7 — Performance & Caching (delegado) → `references/fase-57-performance-caching.md`
**Delega a**: skill `vercel:next-cache-components` — PPR ya habilitado; `apps/web` SSG/ISR; `use cache`/`cacheTag`/`revalidateTag`; ningún RSC de web usa cookies.

### FASE 5.8 — QA de flujos de negocio (delegado) → `references/fase-58-qa-standard.md`
**Delega a**: skill `alyp-qa-standard` — carpeta `qa/`, catálogo con 1 flujo P0 real, CI `qa-e2e.yml`, sello.
**Gate — no avances si falla**: spec P0 verde contra dev, prod `solo_lectura: true`, sello en CLAUDE.md + `standards.yaml`.

### FASE 6 — Primer commit y deploy → `references/fase-06-primer-deploy.md`
**Objetivo**: build local verde antes de pushear; primer deploy READY.
**Pasos clave**: verificar identidad git; `pnpm install` + build local; commit + push a develop (asset `assets/scripts/first-commit.sh`); `vercel ls`; tabla de errores comunes y fixes en la referencia.
**Gate — no avances si falla**: deploy en estado READY y `/api/health` retorna `{ "status": "ok" }`.

### FASE 7 — Documentación → `references/fase-07-documentacion.md`
**Pasos clave**: `docs/CONFIGURACION.md` (arquitectura, IDs de servicios, env vars sin secretos, decisiones, pendientes); memoria del proyecto en `~/.claude/projects/-Users-parb/memory/project_$PROJECT_SLUG.md`; actualizar `MEMORY.md`.

### FASE 8 — Auto-Context → `references/fase-08-auto-context.md`
**Objetivo**: `CLAUDE.md` y `memory/*.md` auto-actualizados via GitHub Actions.
**Pasos clave**: `scripts/generate-context.js` (preserva secciones `<!-- MANUAL -->`); `.github/workflows/update-context.yml` (push a main/develop/staging, auto-commit `[skip ci]`, comenta diff en PRs); secret `CONTEXT_BOT_TOKEN`; generar contexto inicial y llenar secciones `<!-- MANUAL -->`.
**Gate — no avances si falla**: Action en `completed | success`, `CLAUDE.md` generado, al menos un `memory/*.md`.

---

## Checklist final → `references/checklist-final.md`

Al terminar todas las fases, recorrer el checklist completo (común + condicionales por `USE_TURBOREPO` y `USE_MULTITENANCY` + skills pendientes: `alyp-observability` FASE 5.5, `vercel:vercel-firewall` FASE 5.6, `vercel:next-cache-components` FASE 5.7, `alyp-qa-standard` FASE 5.8).
