# FASE 2b — CI Workflow + Branch Protection

> Ejecutar inmediatamente después de FASE 2. El workflow debe existir en el repo ANTES de configurar status checks, o quedarán en estado pendiente permanente.

## CI Workflow

Crear `.github/workflows/ci.yml` (commitear a `develop` y pushear antes de continuar):

**Variante Turborepo** (`USE_TURBOREPO=true`): código completo en [`../assets/ci/ci-turborepo.yml`](../assets/ci/ci-turborepo.yml).

**Variante simple** (`USE_TURBOREPO=false`): reemplazar los steps de verify y build por `pnpm run verify` y `pnpm run build` respectivamente. El job se llama igual (`Build, Lint & Typecheck`) — la branch protection no cambia.

## Branch protection

Aplicar protección a las 3 ramas vía `gh api` (comandos completos en [`../assets/ci/branch-protection.sh`](../assets/ci/branch-protection.sh)):

- **main** — máxima protección: status check estricto sobre `Build, Lint & Typecheck`, `enforce_admins: true`, 1 review requerida con dismiss de reviews stale, sin force push ni borrado, conversaciones resueltas requeridas.
- **staging** — protección media: igual que main pero `enforce_admins: false`.
- **develop** — solo bloquear borrado y force push (sin status checks ni reviews).

## 2b.3 Secrets de GitHub requeridos

Configurar antes del primer PR. Sin estos, el CI y el auto-context fallarán silenciosamente:

```bash
# Token para el sistema Auto-Context (FASE 8)
# Necesita scope: contents:write (para push a develop)
# El bot debe estar en la bypass list de branch protection de develop si es necesario
gh secret set CONTEXT_BOT_TOKEN --repo alyp-studio/$PROJECT_SLUG

# Para generar tipos de Supabase en CI (si se añade el step en el futuro)
# Obtener en: supabase.com → Account → Access Tokens
gh secret set SUPABASE_ACCESS_TOKEN --repo alyp-studio/$PROJECT_SLUG

# Project ID del proyecto DEV (visible en Supabase dashboard → Settings → General)
gh secret set SUPABASE_PROJECT_REF_DEV --repo alyp-studio/$PROJECT_SLUG

# Project ID del proyecto PROD
gh secret set SUPABASE_PROJECT_REF_PROD --repo alyp-studio/$PROJECT_SLUG
```

> Nota sobre CONTEXT_BOT_TOKEN: si `develop` tiene branch protection con `enforce_admins: false` (tal como está configurado), el `GITHUB_TOKEN` default puede hacer push a `develop`. Usar PAT solo si el auto-commit falla con 403.

**Gate de salida**: CI workflow en `develop`, branch protection activa en las 3 ramas.
