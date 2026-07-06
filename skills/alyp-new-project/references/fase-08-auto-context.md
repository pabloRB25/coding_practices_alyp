# FASE 8 — Sistema de Contexto Automático (Auto-Context)

El sistema mantiene `CLAUDE.md` y `memory/*.md` actualizados via GitHub Actions.

## 8.1 Crear `scripts/generate-context.js`

Script que analiza el codebase y genera:
- `CLAUDE.md` en raíz con protocolo de uso para Claude Code, módulos, schema DB, reglas
- `memory/<módulo>.md` por cada módulo con dependencias y co-change patterns

El script preserva las secciones `<!-- MANUAL -->` del `CLAUDE.md` en cada regeneración.

## 8.2 Crear `.github/workflows/update-context.yml`

Workflow que se dispara en push a `main`/`develop`/`staging`, regenera CLAUDE.md + memory/*.md, y hace commit automático con `[skip ci]`.

En PRs: comenta el diff de contexto en el PR.

## 8.3 Registrar `CONTEXT_BOT_TOKEN`

```bash
# Forma recomendada — pide el valor interactivamente
gh secret set CONTEXT_BOT_TOKEN --repo alyp-studio/$PROJECT_SLUG
```

## 8.4 Generar contexto inicial

```bash
node scripts/generate-context.js
```

Editar secciones `<!-- MANUAL -->` del `CLAUDE.md` generado:
1. Descripción del negocio y cliente
2. Convenciones específicas del proyecto
3. Reglas de Supabase (RLS, migrations)
4. Reglas para Claude Code
5. Notas del equipo y decisiones arquitectónicas

Commitear y pushear:
```bash
git add scripts/generate-context.js .github/workflows/update-context.yml CLAUDE.md memory/
git commit -m "feat: auto-context system for Claude Code"
git push origin develop
```

**Gate de salida**: Action en estado `completed | success`. `CLAUDE.md` generado. Al menos un `memory/*.md`.
