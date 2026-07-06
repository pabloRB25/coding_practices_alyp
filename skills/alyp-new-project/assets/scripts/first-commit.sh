# Verificar identidad
git config user.name   # pablopr
git config user.email  # pr@pablorodriguezb.com

# Instalar dependencias
pnpm install

# Verificar que el build pasa localmente antes de pushear
pnpm build   # (o pnpm turbo run build si es Turborepo)

git add .
git commit -m "feat: scaffold inicial enterprise

- Turborepo monorepo (apps/web, apps/app, packages/ui, database, config)
- Security headers + PPR habilitado en next.config.ts
- RLS baseline + tenancy migrations
- App shell: error.tsx, loading.tsx, not-found.tsx, /api/health
- OTel instrumentation placeholder (alyp-observability pendiente)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin develop
