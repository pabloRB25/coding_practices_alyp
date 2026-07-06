# FASE 3.5 — Agentic-Ready Standards (delegado)

> Invocar el skill `alyp-agentic-standards` en modo **bootstrap** con este contexto:

**Tarea**: aplicar el estándar agentic-ready v1 al proyecto `$PROJECT_SLUG`.
- Actualizar `tsconfig.json` de `apps/app` (y `apps/web` si existe) con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`
- Agregar script `verify` (typecheck + lint + test), `new-feature`, `supabase:gen`, `supabase:gen:local` al `package.json` de la app
- Crear estructura `src/features/` (vacía — se puebla por dominio cuando se implementen features)
- Crear `src/types/database.types.ts` placeholder
- Crear `scripts/new-feature.mjs` (generador de features)
- Instalar Vitest + `vitest.config.ts`
- Configurar ESLint: `no-restricted-imports` entre features + `no-console` + `no-empty`
- Generar `CLAUDE.md` slim con sello `<!-- agentic-standard: v1 -->`

**Gate de salida**: `pnpm verify` pasa limpio. `pnpm new-feature test` crea `src/features/test/` con 6 archivos. `CLAUDE.md` tiene sello de versión.
