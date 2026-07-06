# Checklist final

## Común a ambas variantes

- [ ] Variables de FASE 1 anotadas (`PROJECT_SLUG`, `USE_TURBOREPO`, `USE_MULTITENANCY`)
- [ ] Repo GitHub privado creado
- [ ] Ramas `main`, `staging`, `develop` en origin
- [ ] `.github/CODEOWNERS` commiteado
- [ ] `.github/workflows/ci.yml` en `develop` — include `pnpm audit --audit-level=high`
- [ ] Branch protection: `main` (strict + 1 review + enforce_admins), `staging` (strict + 1 review), `develop` (no-force, no-delete)
- [ ] Security headers en `next.config.ts` (HSTS, X-Frame, X-Content-Type, Referrer, Permissions)
- [ ] PPR habilitado (`ppr: "incremental"`) en `next.config.ts`
- [ ] `tsconfig.json` auto-contenido con `baseUrl`, `paths`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [ ] Next.js en versión estable actual (verificada con `npm show next dist-tags.latest`)
- [ ] **Agentic-Ready:** `pnpm verify` script creado y pasa limpio
- [ ] **Agentic-Ready:** `scripts/new-feature.mjs` creado y funciona
- [ ] **Agentic-Ready:** `src/features/` + `src/types/database.types.ts` presentes
- [ ] **Agentic-Ready:** Vitest instalado + `vitest.config.ts`
- [ ] **Agentic-Ready:** ESLint con `no-restricted-imports` entre features
- [ ] **Agentic-Ready:** `CLAUDE.md` slim con sello `agentic-standard: v1`
- [ ] **Agentic-Ready:** `pnpm supabase:gen` y `pnpm supabase:gen:local` en scripts
- [ ] `CookieOptions` tipado explícitamente en `server.ts` y `middleware.ts`
- [ ] `createAdminClient()` con `SERVICE_ROLE_KEY` (server-only)
- [ ] `utils/logger.ts` y `utils/error-codes.ts` stubs creados en scaffold (FASE 3A)
- [ ] `env.ts` valida variables de observabilidad (SERVICE_NAME, LOG_LEVEL, LOG_PROVIDER, etc.)
- [ ] `instrumentation.ts` creado (OTel placeholder)
- [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` en `.env.example` y Vercel como placeholder
- [ ] 3 proyectos Supabase (dev + staging + prod) en estado ACTIVE_HEALTHY
- [ ] `DATABASE_URL` (pooler 6543) y `DIRECT_URL` (5432) configurados
- [ ] Leaked-password protection activada en Supabase Auth
- [ ] `supabase/migrations/0001_rls_baseline.sql` commiteado
- [ ] RLS advisor: 0 tablas sin RLS antes de deploy a PROD
- [ ] `.env.local` con keys DEV (no commiteado)
- [ ] Secrets de GitHub configurados: CONTEXT_BOT_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF_DEV/PROD
- [ ] GitHub App de Vercel con acceso al repo
- [ ] Vercel env vars por git branch (develop → DEV, staging → STAGING, main → PROD)
- [ ] LOG_PROVIDER=local SOLO en machine local — staging y prod usan LOG_PROVIDER=http
- [ ] Vercel Log Drain configurado para staging y production
- [ ] SSO protection desactivada para previews
- [ ] `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` creados
- [ ] `/api/health` retorna `{ "status": "ok" }` en el deploy
- [ ] Primer deploy en estado `READY`
- [ ] `docs/CONFIGURACION.md` commiteado
- [ ] Memoria Claude guardada y `MEMORY.md` actualizado
- [ ] Auto-Context: `generate-context.js` + `update-context.yml` + `CONTEXT_BOT_TOKEN`
- [ ] Auto-Context: `CLAUDE.md` generado, secciones `<!-- MANUAL -->` llenadas

## Solo si `USE_TURBOREPO=true`

- [ ] `turbo.json`, `pnpm-workspace.yaml` presentes
- [ ] `packages/ui`, `packages/database`, `packages/config` scaffoldeados
- [ ] 2 proyectos Vercel (`-web`, `-app`) con build commands turbo filter
- [ ] `ReactQueryDevtools` solo en bundle de desarrollo (no en producción)

## Solo si `USE_TURBOREPO=false`

- [ ] Sin `turbo.json` ni `pnpm-workspace.yaml`
- [ ] 1 proyecto Vercel, root directory en raíz
- [ ] CI workflow usa `pnpm run build/lint/typecheck` (sin turbo)

## Solo si `USE_MULTITENANCY=true`

- [ ] `supabase/migrations/0002_tenancy.sql` con `organizations`, `memberships`, `audit_log`
- [ ] `auth.user_orgs()` helper sin recursión creado
- [ ] `require-role.ts` helper en `src/lib/auth/`
- [ ] Índices sobre `memberships(user_id)` y `memberships(org_id)`
- [ ] `supabase/migrations/0003_auth_trigger.sql` con trigger on_auth_user_created
- [ ] `supabase/seed.sql` con org y datos mínimos de prueba

## Skills pendientes de completar

- [ ] `alyp-observability` — FASE 5.5 pendiente de completar el skill
- [ ] Rate limiting (FASE 5.6) — invocar `vercel:vercel-firewall` al terminar el scaffold
- [ ] Performance/caching (FASE 5.7) — invocar `vercel:next-cache-components` en primera iteración de features
- [ ] FASE 5.8 — `alyp-qa-standard` instalado: `qa/` completo, 1 spec P0 verde, workflow `qa-e2e.yml`, sello `qa-standard: v1` + manifiesto
