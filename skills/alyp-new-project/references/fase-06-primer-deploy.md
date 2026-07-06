# FASE 6 — Primer commit y deploy

Secuencia completa de verificación de identidad, instalación, build local, commit y push en [`../assets/scripts/first-commit.sh`](../assets/scripts/first-commit.sh):

1. Verificar identidad git (`pablopr` / `pr@pablorodriguezb.com`)
2. `pnpm install`
3. Verificar que el build pasa localmente antes de pushear: `pnpm build` (o `pnpm turbo run build` si es Turborepo)
4. `git add .` + commit `"feat: scaffold inicial enterprise"` (mensaje completo en el asset)
5. `git push origin develop`

Verificar deploy en Vercel:
```bash
vercel ls --scope $VERCEL_TEAM_SLUG | grep $PROJECT_SLUG
```

Errores comunes y fixes:

| Error | Causa | Fix |
|-------|-------|-----|
| `VULNERABLE_NEXTJS_VERSION` | Next.js desactualizado | `npm show next dist-tags.latest` y actualizar |
| `Cannot read 'baseUrl'` | tsconfig encadenado | Hacer tsconfig auto-contenido (ver 3A) |
| `Module not found '@/*'` | Falta `baseUrl`+`paths` en tsconfig | Agregar a la app afectada |
| `implicitly has 'any' type` | Falta `CookieOptions` en cookiesToSet | Tipar explícitamente |
| `BLOCKED` en preview | SSO protection activa | `ssoProtection: null` vía API Vercel |
| `too many connections` | Usando conexión directa en serverless | Cambiar a `DATABASE_URL` pooler (6543) |

**Gate de salida**: deploy en estado READY. Verificar `/api/health` retorna `{ "status": "ok" }`.
