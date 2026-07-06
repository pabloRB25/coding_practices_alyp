---
name: agentic-logging
version: 1.1.0
description: >
  Install or audit the "Agentic-First Logging Standard" in any Node/TypeScript
  project (Next.js, Express, workers). Turns errors into structured JSON logs
  that act as GPS navigation for AI agents: one file, one line, one fix.
  Vendor-agnostic (stdout/stderr only; persistence delegated to the platform).
  Use when the user asks to "add agentic logging", "set up the logging standard",
  "make logs AI-readable / agent-friendly", "implement agent-gps", or scaffolds a
  new project that should debug itself.
---

# Agentic-First Logging Standard

Logs as GPS for AI agents. Errors are structured JSON whose `error.ubicacion_exacta`
(plus `archivo`/`linea`/`funcion`) points the agent straight to the failing line in
**your** code — skipping `node_modules`/framework noise (the "honeypot"). Output is
stdout/stderr only; persistence is delegated to the deploy platform (e.g. Vercel Log
Drains → Axiom/Datadog/Logflare), so there is **no backend dependency in code**.

## The 3 golden rules (non-negotiable)
1. **No plain-text errors** — every error is JSON with `traceId`, `contexto`, `error`.
2. **Honeypot** — the logged location is the first line of *your* code, not internals.
3. **Agnostic output** — app only writes to stdout/stderr; the platform persists.

## When to use
- New project scaffolding, or adding/auditing logging in an existing repo.
- Any Node/TS project — not Next.js-specific.
- For Alyp Studio projects: this skill is invoked automatically by `alyp-observability` (FASE 5.5 of `alyp-new-project`). Use directly only for non-Alyp projects.

## Files this skill installs (all live in `assets/` of this skill)

Do NOT rewrite or regenerate this code — **COPY the files verbatim from this
skill's `assets/` directory with `cp`**. The only things that change per project
are env variables (`SERVICE_NAME`, `APP_SOURCE_DIRS`, `LOG_PROVIDER`), never the code.

| Asset | Installs as | Contents |
|-------|-------------|----------|
| `assets/logger.ts` | `utils/logger.ts` | `agenticLogger` (error + info/warn/debug), recursive PII scrub, honeypot location, `nuevoTraceId()`, `crearLoggerDeRuta()`. Zero deps. |
| `assets/error-codes.ts` | `utils/error-codes.ts` | UPPER_SNAKE `CODIGOS` + `mapearCodigoPostgres()`. |
| `assets/agent-gps.mjs` | `scripts/agent-gps.mjs` | extractor (providers: `local \| axiom \| http`). |
| `assets/.eslintrc.agentic.cjs` | merge into ESLint config | `no-console` + `no-empty` rules. |
| `assets/github-workflow-agentic-logging.yml` | `.github/workflows/agentic-logging.yml` | CI audit (naked console.*, empty catch). |
| `assets/CLAUDE.md.append` | append to project `CLAUDE.md` | autonomous debugging protocol. |
| `assets/env.example` | merge into `.env.example` | env keys for logger + extractor + OTel. |

## Steps (mode: bootstrap — new/clean project)

Let `SKILL_DIR=~/.claude/skills/agentic-logging` and `UTILS_DIR` be the project's utils/lib dir.

1. Detect language (TS/JS), package manager, and source layout.
2. Copy the logger and error codes **verbatim** into the project:
   ```bash
   cp "$SKILL_DIR/assets/logger.ts"      "$UTILS_DIR/logger.ts"
   cp "$SKILL_DIR/assets/error-codes.ts" "$UTILS_DIR/error-codes.ts"
   ```
   Do not edit the code. Per-project adaptation happens only via env vars:
   set `APP_SOURCE_DIRS` to the real source dirs (monorepo → include `packages`).
3. Copy the extractor:
   ```bash
   mkdir -p scripts && cp "$SKILL_DIR/assets/agent-gps.mjs" scripts/agent-gps.mjs
   ```
4. Add to `package.json` scripts:
   ```json
   "agent:gps":   "node scripts/agent-gps.mjs",
   "logs:errors": "grep '\"nivel\":\"error\"' logs/dev.log || true"
   ```
5. Merge the rules from `assets/.eslintrc.agentic.cjs` into the project's ESLint config
   (or `cp` it as `.eslintrc.agentic.cjs` and extend it).
6. Copy the CI workflow:
   ```bash
   mkdir -p .github/workflows
   cp "$SKILL_DIR/assets/github-workflow-agentic-logging.yml" .github/workflows/agentic-logging.yml
   ```
7. Append the debugging protocol to the project's `CLAUDE.md` (or `AGENTS.md`):
   ```bash
   cat "$SKILL_DIR/assets/CLAUDE.md.append" >> CLAUDE.md
   ```
8. Merge the keys from `assets/env.example` into the project's `.env.example` / `.env.local`,
   filling the per-project values: `SERVICE_NAME`, `APP_SOURCE_DIRS`, `LOG_PROVIDER` (+ provider creds).
9. For local dev, pipe stdout to a file:
   `next dev | tee logs/dev.log` — add `logs/` to `.gitignore`.
10. **Verify** (see below).

## Steps (mode: audit — existing project)

Same, but INTEGRATE — never clobber existing logger/middleware/CI.
- Replace every `console.log/console.error/console.warn` used for diagnostics with
  the matching `agenticLogger` call; assign an error `codigo`.
- Fix empty `catch` blocks: each must call `agenticLogger.error(ctx, err)`.

## Usage pattern

```typescript
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';

const log = crearLoggerDeRuta(nuevoTraceId(), 'inventario:descontar-stock', { sku });
log.info('inicio');
try {
  // ...lógica...
} catch (err) {
  log.error(err, { codigo: mapearCodigoPostgres((err as any).code) });
}
```

When something fails, give the `traceId` to the agent:

```bash
npm run agent:gps tr_12345
# → prints archivo + linea + motivo + <<<AGENT_GPS_JSON>>>
```

## Log schema (error contract)

```jsonc
{
  "nivel": "error",
  "servicio": "mi-proyecto",
  "env": "production",
  "release": "a1b2c3d",
  "timestamp": "2026-05-29T10:30:00.000Z",
  "traceId": "tr_12345",
  "contexto": "inventario:descontar-stock",
  "metadata": { "sku": "ABC-1" },
  "error": {
    "mensaje": "new row violates row-level security policy",
    "codigo": "REGLA_RLS_VIOLADA",
    "ubicacion_exacta": "at descontarStock (/app/src/lib/inventario.ts:42:11)",
    "archivo": "/app/src/lib/inventario.ts",
    "linea": 42,
    "columna": 11,
    "funcion": "descontarStock",
    "stack_snippet": ["Error: ...", "at descontarStock (...)"]
  }
}
```

## Verification (acceptance)

- A thrown error produces a JSON line on stderr with `traceId`, `contexto`, and
  `error.archivo` + `error.linea` pointing to project source (not node_modules).
- `node scripts/agent-gps.mjs <traceId>` prints the navigation block and the
  `<<<AGENT_GPS_JSON>>>` object with `archivo`/`linea`.
- ESLint fails on a naked `console.*` and on an empty `catch`.

## Per-project variables (only these change)

`SERVICE_NAME`, `APP_SOURCE_DIRS`, `LOG_PROVIDER` (+ provider creds). Code is identical across projects.

## Guardrails

- Never hardcode a log backend in app code — only stdout/stderr + env-driven extractor.
- Redaction is recursive; never log full bodies with PII (extend `LOG_REDACT_KEYS`).
- **Production source maps**: `ubicacion_exacta` is only useful if server source maps
  are enabled (else paths point to compiled `.next`). Enable them in the deploy.
- `LOG_PROVIDER=local` only works with `next dev` locally. In Vercel (any environment),
  use `http` or configure a Log Drain — serverless filesystem is ephemeral.

## Compatible log backends (OTLP / HTTP)

Change backend = change env vars, zero code changes:

| Backend | LOG_PROVIDER | Notes |
|---------|-------------|-------|
| Local dev | `local` | reads `logs/dev.log` |
| Axiom | `axiom` | APL queries |
| Datadog, Grafana, New Relic, Honeycomb | `http` | generic OTLP/HTTP endpoint |
| Self-hosted (Jaeger, Loki) | `http` | any endpoint |
