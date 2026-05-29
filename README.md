# Coding Practices — Alyp Studio

Repositorio central de estándares de código, skills de Claude Code y prácticas de desarrollo de Alyp Studio.

**Versión del estándar**: `agentic-standard: v1`  
**Stack**: Turborepo · Next.js · Supabase · Vercel · GitHub  
**Principio rector**: optimizar el ciclo del agente — LEER → ENTENDER → CAMBIAR → VERIFICAR

---

## ¿Qué hay aquí?

Este repositorio contiene el ecosistema completo que Alyp Studio usa para crear y mantener proyectos SaaS enterprise. Está organizado en torno a un concepto central: **el código debe ser fácil de consumir por un agente de IA**, no solo por humanos.

```
coding_practices_alyp/
├── skills/                    # Skills de Claude Code (instalables)
│   ├── alyp-new-project.md   # Orquestador — crea un proyecto desde cero
│   ├── alyp-observability.md # Observabilidad: logging GPS + OTel + Log Drains
│   ├── alyp-agentic-standards.md  # Arquitectura por features + verify gate
│   └── agentic-logging.md    # Logging standalone para cualquier proyecto Node/TS
├── guides/
│   └── guia-codigo-agentic-ready.md  # Guía de referencia completa del estándar
└── docs/
    ├── skill-ecosystem.md    # Cómo se relacionan los 4 skills
    ├── environment-strategy.md  # Estrategia de ambientes dev/staging/prod
    └── installation.md       # Cómo instalar los skills en Claude Code
```

---

## Quick Start — Crear un proyecto nuevo

1. Instalar los skills (ver [docs/installation.md](docs/installation.md))
2. En Claude Code, invocar:
   ```
   /alyp-new-project
   ```
3. Seguir las 16 fases en orden — el skill hace el resto

---

## Los 4 Skills

### `alyp-new-project` — Orquestador principal

El punto de entrada para cualquier proyecto nuevo. Coordina 16 fases en orden:

| Fase | Qué hace | Delegado a |
|------|----------|-----------|
| 0 | Pre-flight (herramientas, auth) | — |
| 1 | Decisiones arquitectónicas (Turborepo, multi-tenancy) | — |
| 2 | Repo GitHub + ramas + CODEOWNERS | — |
| 2b | CI + branch protection + secrets | — |
| 3A/3B | Scaffold completo (tsconfig, next.config, packages) | — |
| 3.5 | Estándares agentic-ready | `alyp-agentic-standards` |
| 3.6 | Data layer: RLS + tenancy + seed + auth trigger | — |
| 3.7 | App shell: error.tsx, loading.tsx, /api/health | — |
| 4 | Supabase (3 proyectos: dev/staging/prod) | `supabase:supabase` |
| 5 | Vercel (proyectos, env vars por branch, Log Drain) | `vercel:bootstrap` |
| 5.5 | Observabilidad completa | `alyp-observability` |
| 5.6 | Rate limiting | `vercel:vercel-firewall` |
| 5.7 | Performance y caching | `vercel:next-cache-components` |
| 6 | Primer commit y deploy | — |
| 7 | Documentación + memoria Claude | — |
| 8 | Auto-Context (CLAUDE.md auto-actualizado) | — |

---

### `alyp-agentic-standards` — Código legible por agentes

Aplica el estándar `agentic-standard: v1` a cualquier proyecto. Dos modos:
- **bootstrap**: proyecto nuevo — crea toda la estructura
- **audit**: proyecto existente — integra sin romper

**Qué instala:**
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- `pnpm verify` como gate único (typecheck + lint + test)
- Arquitectura `src/features/<dominio>/<dominio>.<rol>.ts`
- Generador `pnpm new-feature <dominio>` con migration stub + RLS template
- Barrels `index.ts` + ESLint `no-restricted-imports` entre features
- Vitest co-localizado con los tests
- `CLAUDE.md` slim con sello `<!-- agentic-standard: v1 -->`

---

### `alyp-observability` — Logging GPS + OTel agnóstico

Instala la capa de observabilidad completa. **Sin vendor lock-in**: el código solo escribe a stdout/stderr; el backend es una env var.

**Qué instala:**
- `utils/logger.ts` — `agenticLogger` con honeypot (apunta a TU línea de código), PII scrub recursivo, 4 niveles
- `utils/error-codes.ts` — códigos `UPPER_SNAKE` + `mapearCodigoPostgres()`
- `scripts/agent-gps.mjs` — extractor multi-proveedor: `local | axiom | http`
- `instrumentation.ts` — OTel con `@vercel/otel` (agnóstico de backend)
- Web Vitals RUM → `/api/vitals` → mismo stream JSON
- FASE 4.5: configuración de Vercel Log Drain

**Cuando hay un error:**
```bash
pnpm agent:gps <traceId>
# → imprime <<<AGENT_GPS_JSON>>> con archivo + línea exactos
```

---

### `agentic-logging` — Logging standalone

El mismo estándar de logging GPS pero para cualquier proyecto Node/TS, sin el resto del scaffold de Alyp. Útil para proyectos existentes o proyectos fuera del stack principal.

---

## Los 3 artefactos (no mezclar)

```
1. Este repo (fuente de verdad)
   → guía completa + skills versionados
   → no se copia a cada proyecto

2. Skills en Claude Code (~/.claude/commands/)
   → aplican el estándar: scaffolding, logging, arquitectura, verify
   → invocarlos con /alyp-new-project, /alyp-observability, etc.

3. CLAUDE.md slim en cada proyecto
   → generado por alyp-agentic-standards
   → lo único que el agente lee cada sesión
   → contiene: stack, comandos, mapa de ambientes, runbook de features
```

**Regla**: la guía se escribe una vez (aquí), el skill la aplica muchas veces, y el CLAUDE.md slim la resume para el día a día del agente.

---

## Estrategia de ambientes

Cada proyecto tiene 3 Supabase + Vercel configurados por git branch:

| Rama | Supabase | Vercel scope | `LOG_PROVIDER` |
|------|----------|--------------|----------------|
| `next dev` local | DEV | — | `local` |
| `develop` branch | DEV | Preview (develop) | `http` |
| `staging` branch | STAGING | Preview (staging) | `http` |
| `main` | PROD | Production | `http` |

> `LOG_PROVIDER=local` SOLO en `next dev` local. En Vercel (cualquier ambiente) usar `http` + Log Drain.

---

## Principios de diseño

**Agnóstico por defecto**
Toda integración de plataforma via env var estándar o protocolo abierto (OTel/OTLP). Cambiar de Axiom a Datadog = cambiar credenciales, no código.

**RLS deny-by-default**
Toda tabla tiene RLS habilitado. Las políticas se declaran explícitamente. El trigger `handle_new_user()` crea org+membership al signup.

**El agente como usuario principal**
El código está estructurado para que un agente de IA pueda leer menos, entender más, cambiar con confianza y verificar en un comando.

**Stubs → implementación completa**
`utils/logger.ts` y `utils/error-codes.ts` se crean como stubs tipados en el scaffold y se reemplazan con implementación completa en FASE 5.5. El código compila desde el día 1.

---

## Versionado del estándar

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| `v1` | 2026-05-29 | Versión inicial: feature architecture, agentic logging GPS, OTel agnóstico, 3 ambientes, RLS deny-by-default, verify gate |

Para actualizar proyectos existentes a una nueva versión:
```bash
# En el proyecto, invocar en modo audit:
/alyp-agentic-standards
# → seleccionar modo: audit
```

---

## Contribuir / Actualizar

1. Modificar el skill correspondiente en `skills/`
2. Actualizar `CHANGELOG.md` con la descripción del cambio
3. Incrementar la versión en el skill y en el sello `agentic-standard: vX`
4. Copiar los archivos actualizados a `~/.claude/commands/` en las máquinas del equipo
5. Correr `alyp-agentic-standards` en modo `audit` sobre proyectos existentes para actualizar su `CLAUDE.md`
