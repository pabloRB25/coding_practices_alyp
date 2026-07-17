# Changelog

## v2.2.0 — 2026-07-16

### devstral-orchestration v2.7.1 — Opus orquesta, Fable consulta, offloading obligatorio

- **Doctrina nueva**: se elimina la dualidad Fable/Opus de v2.5-v2.6. El orquestador es **SIEMPRE Opus** (autoridad plena); Fable existe únicamente como agente `consultor` de **invocación explícita** (duda real o pedido del usuario). Fallbacks: Fable como loop orquesta igual sin consultor (es el techo); Sonnet/Haiku = modo degradado con consulta obligatoria en crítico.
- **Offloading local OBLIGATORIO**: toda subtarea mecánica + verificable + inequívoca VA al ejecutor local (light default; heavy de a una). Queda derogada la regla v2.6 "para velocidad pura, el local es opcional". Excepciones únicas: gobernador saturado (→ haiku), Ollama apagado (→ haiku), contexto > num_ctx o spec ambiguo (→ sonnet). El local es llamable directo por el orquestador Opus y por el implementador Sonnet (cascada).
- **Perfil del equipo** documentado en el SKILL (validado 2026-07-16, M3 Pro 36 GB/12c): light+QA ≈ 6 GB = camino de paralelismo seguro (2 delegaciones vivas), heavy ~21 GB no co-reside; ola cloud = 10, subagentes Opus ≤ 3/ola.
- `capacity.yaml` → **version 2**: nueva key `orquestador` + comentarios de roles v2.7.1 (mismas keys de tiers, sin breaking).
- `contracts/orchestration.md` → **v1.1**: sección "Modo estándar (desde protocolo v2.7)" + invariante 2 endurecido (offloading obligatorio, escalación explícita al juez).
- Agentes `implementador`/`explorador`/`revisor`/`consultor` alineados: el que despacha es el orquestador Opus; cascada local obligatoria en el implementador; consultor = única vía de acceso a Fable. Se quitan modelos locales hardcodeados de las descripciones (fuente: capacity.yaml).
- CLAUDE.md global unificado a v2.7.1 (resuelve el drift v2.5 detectado el 2026-07-16): índice sin modelos hardcodeados, puntero a capacity.yaml.
- v2.6 archivada en `skills/devstral-orchestration/versions/v2.6/`.

## v2.1.0 — 2026-07-06

### Soporte cross-platform (macOS · Linux · Windows)

- Instalador reescrito en Node (`scripts/install.mjs`) — reemplaza el bash; junctions sin admin en Windows, merge de `settings.json` en Node puro (sin dependencia de `python3`), detección de intérprete de Python para token-savings. `install.sh`/`install.ps1` quedan como shims.
- `check-drift.mjs` y `canary.mjs` portados a Node (cross-platform); shims `.sh` conservados.
- CI canario en matriz `ubuntu-latest` + `windows-latest` con smoke de instalación real.
- token-savings 1.0.1: hook usa tempdir portable (no `/tmp`); intérprete tolerante `python`/`python3`.
- Docs: vía plugin elevada como #1 cross-platform; requisitos por plataforma (Node ≥ 20.11; Git for Windows para la herramienta Bash; Python 3 opcional para token-savings).
- Boundary documentado: instalación y meta-QA 100% cross-platform; el uso de skills con shell POSIX requiere Git Bash en Windows (requisito de Claude Code).

## v2.0.0 — 2026-07-06 (en curso)

### El repo pasa a ser fuente de verdad + instalador

- Los 7 skills completos (con assets/references/templates) viven en `skills/`; `~/.claude/skills/` es una instalación (symlink en dev, copia en equipos).
- Capa `contracts/`: invariantes agnósticos versionados, separados del perfil de stack next·supabase·vercel.
- Manifiesto de estándares por repo (`standards.yaml`) + sello `logging-standard: v1`.
- QA cableado como FASE 5.8 de alyp-new-project; FASE 5.5 deja de ser placeholder.
- devstral-orchestration v2.6: tiers abstractos + `capacity.yaml` por máquina.
- Instalador `scripts/install.sh` + empaquetado como plugin de Claude Code.
- Meta-QA: `lint-skills.mjs` + canario en CI.
- Fix agentic-logging 1.1.1 (detectado por el canario de Task 14): (a) logger.ts compila bajo strict + noUncheckedIndexedAccess — non-null assertions en los grupos de captura de `parseLinea`, justificadas por el `if (match)` previo (7 errores TS2322/TS2345/TS2532; sin cambios de comportamiento); (b) `.eslintrc.agentic.cjs` — se quita `allow: []` de `no-console` (el schema de ESLint 8 exige minItems: 1 y abortaba toda la config; el default ya prohíbe todo console.*).
- Fix scripts/canary.sh: error de sintaxis bash latente en el step 3 (heredoc encadenado con `&&` en línea continuada); nunca se había ejecutado porque el step 2 fallaba antes. Con ambos fixes, `./scripts/canary.sh` llega a "CANARIO OK".

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
