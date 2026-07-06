# FASE 5.8 — QA de flujos de negocio (delegado)

**Delega a**: skill `alyp-qa-standard` (instalación completa, pasos 1–8 de su SKILL.md).

**Objetivo**: el proyecto nace con el estándar de pruebas instalado: carpeta `qa/`
(config, catálogo, seeds, e2e Playwright, smoke agéntico), workflow CI `qa-e2e.yml`
y sello `qa-standard: v1`.

**Alcance en proyecto nuevo**: el catálogo arranca con 1 flujo P0 real (login o el
health-path de negocio mínimo) — NO inventar flujos que el producto aún no tiene.
El resto del catálogo se puebla feature a feature (runbook de `alyp-agentic-standards`).

**Ambientes**: `qa.config.yaml` apunta a DEV (Supabase dev de FASE 4, preview de
FASE 5). PROD queda `solo_lectura: true` desde el día 1.

**Gate — no avances si falla**: `qa/qa.config.yaml` existe con prod solo-lectura;
1 spec P0 pasa contra el ambiente dev (`pnpm --filter qa e2e`); workflow `qa-e2e.yml`
en `.github/workflows/`; sello `qa-standard: v1` en CLAUDE.md y en `standards.yaml`.
