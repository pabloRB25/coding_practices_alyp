# Changelog

## v2.0.0 — 2026-07-06 (en curso)

### El repo pasa a ser fuente de verdad + instalador

- Los 7 skills completos (con assets/references/templates) viven en `skills/`; `~/.claude/skills/` es una instalación (symlink en dev, copia en equipos).
- Capa `contracts/`: invariantes agnósticos versionados, separados del perfil de stack next·supabase·vercel.
- Manifiesto de estándares por repo (`standards.yaml`) + sello `logging-standard: v1`.
- QA cableado como FASE 5.8 de alyp-new-project; FASE 5.5 deja de ser placeholder.
- devstral-orchestration v2.6: tiers abstractos + `capacity.yaml` por máquina.
- Instalador `scripts/install.sh` + empaquetado como plugin de Claude Code.
- Meta-QA: `lint-skills.mjs` + canario en CI.

## v1 — 2026-05-29

### Versión inicial del ecosistema de skills

**Skills creados:**
- `alyp-new-project` — Orquestador de 16 fases para proyectos SaaS enterprise
- `alyp-agentic-standards` — Estándar agentic-ready v1
- `alyp-observability` — Logging GPS + OTel agnóstico
- `agentic-logging` — Logging standalone para cualquier proyecto Node/TS

**Características principales:**
- Stack: Turborepo + Next.js + Supabase + Vercel + GitHub
- Arquitectura por features: `src/features/<dominio>/<dominio>.<rol>.ts`
- Gate único: `pnpm verify` = typecheck + lint + test
- 3 ambientes reales separados (dev / staging / prod)
- RLS deny-by-default en todas las tablas
- Auth trigger `handle_new_user()` para multi-tenancy
- Logger GPS con honeypot y PII scrub (cero dependencias)
- OTel agnóstico via `@vercel/otel` + env var para backend
- Vercel Log Drain como transporte en producción
- CLAUDE.md slim auto-generado con sello de versión
- Generador de features `pnpm new-feature <dominio>` con migration stub + RLS template
- Patrón de stubs (logger/error-codes) que resuelve dependencias de orden de instalación

**Decisiones arquitectónicas documentadas:**
- `utils/logger.ts` y `utils/error-codes.ts` como stubs tipados en scaffold, reemplazados por implementación completa en FASE 5.5
- `LOG_PROVIDER=local` solo válido para `next dev` local — en Vercel usar `http` + Log Drain
- Staging tiene su propio Supabase (no comparte con develop)
- `createAdminClient()` con service_role: solo en Node runtime, nunca en Edge middleware

**Problemas resueltos respecto a la versión anterior (sin estándar):**
- Sin arquitectura consistente entre proyectos
- Sin RLS por defecto — tablas expuestas sin políticas
- Sin observabilidad — logs text plano, imposibles de consumir por agentes
- Sin gate de verificación — CI no corría tests
- Sin modelo de ambientes coherente — staging y develop compartían DB
- Sin CLAUDE.md slim — el agente arrancaba cada sesión sin contexto
- Sin generador de features — cada feature se scaffoldeaba de forma diferente
