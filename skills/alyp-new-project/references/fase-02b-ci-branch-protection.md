# FASE 2b — CI Workflow + Branch Protection

> Ejecutar inmediatamente después de FASE 2. El workflow debe existir en el repo ANTES de configurar status checks, o quedarán en estado pendiente permanente.

## Workflows de los 3 gates

Los tres gates de qa-standard §Promoción entre ambientes. Commitear a `develop`
y pushear antes de configurar la protección:

| Archivo | Asset | Dispara | Check | Bloquea |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | [`ci-turborepo.yml`](../assets/ci/ci-turborepo.yml) | PR a `develop` | `Gate DEV` | no |
| `.github/workflows/gate-stg.yml` | [`gate-stg.yml`](../assets/ci/gate-stg.yml) | PR a `staging` | `Gate STG` | **sí** |
| `.github/workflows/gate-main.yml` | [`gate-main.yml`](../assets/ci/gate-main.yml) | PR a `main` | `Gate MAIN` | **sí** |

`gate-stg.yml` y `gate-main.yml` invocan dos workflows reutilizables del skill
`alyp-qa-standard` que hay que copiar también: `qa-e2e.yml` (flujos P0+P1 con
los tres oráculos) y `smoke.yml` (P0 solo-lectura contra el deploy).

**Variante simple** (`USE_TURBOREPO=false`): reemplazar los steps de verify y
build por `pnpm run verify` y `pnpm run build`. Los nombres de los jobs
agregadores NO cambian — la branch protection depende de ellos.

> ⚠ El check requerido es el job **agregador** de cada gate (`Gate STG`,
> `Gate MAIN`), no cada job individual. Así, agregar una validación nueva al
> gate no deja la protección desactualizada en silencio.

## Branch protection

Aplicar a las 3 ramas con [`../assets/ci/branch-protection.sh`](../assets/ci/branch-protection.sh)
(requiere `PROJECT_SLUG` exportado):

- **main** — status check estricto sobre `Gate MAIN`, `enforce_admins: true`,
  1 review con dismiss de stale, sin force push ni borrado, conversaciones
  resueltas.
- **staging** — igual pero sobre `Gate STG` y con `enforce_admins: false`: es la
  válvula de escape para un hotfix, y su uso queda registrado.
- **develop** — solo bloquear borrado y force push. Sin checks requeridos: lo
  que valida el cambio es el gate LOCAL (`pnpm verify:full`), y bloquear acá lo
  duplicaría.

> ⚠ **El nombre del check es el contrato de bloqueo** (qa-standard G4). Si
> renombrás el job agregador sin actualizar este script, el check requerido deja
> de reportar y el PR queda pendiente para siempre — que no es lo mismo que
> pasar. Se cambian juntos. Verificar después de aplicar:
>
> ```bash
> gh api repos/alyp-studio/$PROJECT_SLUG/branches/staging/protection -q .required_status_checks.contexts
> ```
>
> Ese contexto tiene que existir como job en un workflow que dispare en PRs a
> esa rama. Si no coincide, el gate está mudo.

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

# Ambiente QA — sin estos, los flujos del Gate STG quedan SKIPPED (no fallan,
# pero tampoco validan nada: el gate pasa a ser verify+build otra vez).
# Apuntan al Supabase DEV; el reset está acotado al namespace QA (P7).
gh secret set QA_SUPABASE_URL --repo alyp-studio/$PROJECT_SLUG
gh secret set QA_SUPABASE_SERVICE_ROLE --repo alyp-studio/$PROJECT_SLUG
gh secret set QA_SUPABASE_DB_URL --repo alyp-studio/$PROJECT_SLUG
# + una credencial por rol de prueba del catálogo (QA_PASSWORD_*, QA_UID_*)

# URL del deploy de staging, para el smoke del Gate MAIN (variable, no secret)
gh variable set QA_STG_URL --repo alyp-studio/$PROJECT_SLUG
```

> Nota sobre CONTEXT_BOT_TOKEN: si `develop` tiene branch protection con `enforce_admins: false` (tal como está configurado), el `GITHUB_TOKEN` default puede hacer push a `develop`. Usar PAT solo si el auto-commit falla con 403.

**Gate de salida**: los 3 workflows en `develop`, branch protection activa en las
3 ramas, y `gh api … -q .required_status_checks.contexts` devolviendo exactamente
`Gate STG` en staging y `Gate MAIN` en main.
