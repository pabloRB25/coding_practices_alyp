# FASE 1 — Arquitectura del proyecto

## 1.1 Recopilar variables

Preguntar y anotar en memoria de sesión:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PROJECT_SLUG` | Nombre del repo, kebab-case | `servicentro-elcruce` |
| `PACKAGE_SCOPE` | Scope pnpm (solo Turborepo) | `elcruce` |
| `CLIENT_NAME` | Nombre del cliente | `Servicentro El Cruce` |
| `VERCEL_TEAM_SLUG` | Slug del equipo Vercel | `alyp-studio-60cb7d7a` |
| `VERCEL_TEAM_ID` | ID del equipo Vercel | `team_FamhgJYl3MRguMGL6nzMlzpX` |
| `GITHUB_ORG` | Organización GitHub | `alyp-studio` (siempre) |
| `BASE_DIR` | Directorio local donde clonar | `~/Projects` |

## 1.2 Decisión: ¿Turborepo o Next.js simple?

| Escenario | `USE_TURBOREPO` |
|-----------|----------------|
| 2+ apps (web marketing + app transaccional, frontend + backend API) | `true` |
| 1 app + segunda app planeada en < 6 meses | `true` |
| 1 app + expansión > 6 meses o indefinida | `false` |
| 1 app + sin planes de segunda app | `false` |

Anotar `USE_TURBOREPO=true|false`. Esta variable gobierna FASE 3, FASE 5 y el CI.

## 1.3 Decisión: ¿Multi-tenancy intra-app?

| Escenario | `USE_MULTITENANCY` |
|-----------|-------------------|
| El SaaS tiene organizaciones / equipos / cuentas empresa | `true` |
| Single-tenant (1 empresa, 1 instancia) | `false` |

Anotar `USE_MULTITENANCY=true|false`. Controla FASE 3.5.
