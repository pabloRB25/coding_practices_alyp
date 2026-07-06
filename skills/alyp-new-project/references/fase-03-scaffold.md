# FASE 3 — Scaffold

Obtener la versión estable actual de Next.js antes de escribir cualquier package.json:
```bash
NEXT_VERSION=$(npm show next dist-tags.latest)
echo "Next.js estable: $NEXT_VERSION"
```

Nunca hardcodear una versión — Vercel bloquea versiones con vulnerabilidades conocidas.

---

## FASE 3A — Turborepo (`USE_TURBOREPO=true`)

**Estructura objetivo**:
```
$PROJECT_SLUG/
├── apps/
│   ├── web/          # Next.js marketing (port 3000)
│   └── app/          # Next.js plataforma (port 3001)
├── packages/
│   ├── ui/           # shadcn/ui compartido
│   ├── database/     # cliente Supabase + tipos generados
│   └── config/       # ESLint + Prettier + Tailwind shared config
├── supabase/
│   └── migrations/
├── scripts/
├── .github/
├── turbo.json
└── pnpm-workspace.yaml
```

**`package.json` raíz**: código completo en [`../assets/config/package.root.json`](../assets/config/package.root.json).

**`pnpm-workspace.yaml`**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`**: código completo en [`../assets/config/turbo.json`](../assets/config/turbo.json).

**`.gitignore`**:
```
node_modules
.pnpm-store
.next
dist
.turbo
.env
.env.local
.env.*.local
.vercel
supabase/.branches
supabase/.temp
.DS_Store
```

### tsconfig — SIEMPRE auto-contenido por app

NUNCA extender desde `packages/config` — causa errores de resolución en Vercel.

`apps/web/tsconfig.json` y `apps/app/tsconfig.json` (idénticos): código completo en [`../assets/config/tsconfig.app.json`](../assets/config/tsconfig.app.json).

### next.config.ts — con security headers base

`apps/web/next.config.ts`: código completo en [`../assets/config/next.config.web.ts`](../assets/config/next.config.web.ts).

`apps/app/next.config.ts`: código completo en [`../assets/config/next.config.app.ts`](../assets/config/next.config.app.ts) (igual que web pero `transpilePackages` incluye también `@$PACKAGE_SCOPE/database`).

### package.json de cada app

`apps/app/package.json`: código completo en [`../assets/config/package.app.json`](../assets/config/package.app.json).

`apps/web/package.json`: código completo en [`../assets/config/package.web.json`](../assets/config/package.web.json).

### Supabase client — tipos explícitos SIEMPRE

`apps/app/src/lib/supabase/server.ts`: código completo en [`../assets/supabase/server-client.ts`](../assets/supabase/server-client.ts). Incluye `createClient()` (anon, con cookies) y `createAdminClient()` (server-only — NUNCA exponer al cliente).

### Logging y error codes — instalación base

Crear `apps/app/src/utils/logger.ts` y `apps/app/src/utils/error-codes.ts` como parte del scaffold.

> Nota: el contenido completo de estos archivos lo instala el skill `alyp-observability` en FASE 5.5.
> Aquí solo se crean los stubs tipados para que el código generado por `new-feature.mjs` compile desde el día 1.

`apps/app/src/utils/logger.ts` (stub): código completo en [`../assets/observability/logger-stub.ts`](../assets/observability/logger-stub.ts).

`apps/app/src/utils/error-codes.ts` (stub): código completo en [`../assets/observability/error-codes-stub.ts`](../assets/observability/error-codes-stub.ts).

> FASE 5.5 (`alyp-observability`) reemplazará estos stubs con la implementación completa (honeypot, PII scrub, niveles, etc.).

### Edge vs Node runtime — regla de seguridad

El middleware corre en **Edge runtime** por defecto. No usar en Edge:
- `createAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY` — expone el key fuera del servidor Node
- `agenticLogger` con honeypot completo — usa APIs de Node que no existen en Edge

En route handlers y Server Actions: **Node runtime** (default, sin `export const runtime = 'edge'`).
En middleware: solo `anon key` + lógica mínima de cookies.

```typescript
// ✅ Correcto — solo en Server Actions / Route Handlers (Node)
import { createAdminClient } from '@/lib/supabase/server';

// ❌ Nunca en middleware.ts (Edge)
// import { createAdminClient } from '@/lib/supabase/server';
```

`apps/app/src/middleware.ts`: código completo en [`../assets/supabase/middleware.ts`](../assets/supabase/middleware.ts).

### packages/ui — shadcn/ui base

`packages/ui/package.json`: código completo en [`../assets/config/package.ui.json`](../assets/config/package.ui.json).

Componentes base en `packages/ui/src/components/`:
`button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`, `avatar.tsx`, `textarea.tsx`, `sonner.tsx`

`packages/ui/src/index.ts`:
```typescript
export { Avatar, AvatarFallback, AvatarImage } from "./components/avatar";
export { Badge, badgeVariants }                from "./components/badge";
export { Button, buttonVariants }              from "./components/button";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/card";
export { Input }     from "./components/input";
export { Label }     from "./components/label";
export { Separator } from "./components/separator";
export { Skeleton }  from "./components/skeleton";
export { Toaster }   from "./components/sonner";
export { Textarea }  from "./components/textarea";
export { cn }        from "./lib/utils";
```

Lucide: importar siempre por icono individual (`import { ChevronDown } from "lucide-react"`), nunca barrel import — afecta bundle size.

### packages/database

`packages/database/src/client.ts`:
```typescript
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createClient(url: string, key: string) {
  return createSupabaseClient<Database>(url, key);
}
```

`packages/database/src/types.ts` — placeholder hasta generar tipos reales:
```typescript
export type Database = Record<string, unknown>; // reemplazar con: supabase gen types typescript
```

### packages/config — ESLint + Prettier + Tailwind shared

`packages/config/package.json`:
```json
{
  "name": "@$PACKAGE_SCOPE/config",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./eslint":    "./eslint.js",
    "./prettier":  "./prettier.js",
    "./tailwind":  "./tailwind.js"
  }
}
```

`packages/config/prettier.js`:
```javascript
module.exports = {
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  printWidth: 100,
  tabWidth: 2,
};
```

### Providers y validación de env

`apps/app/src/providers/query-provider.tsx`: código completo en [`../assets/app/query-provider.tsx`](../assets/app/query-provider.tsx) (ReactQueryDevtools solo en desarrollo — NO en bundle de producción).

`apps/app/src/lib/env.ts`: código completo en [`../assets/app/env.ts`](../assets/app/env.ts) (validación con `@t3-oss/env-nextjs` + zod, incluye variables de observabilidad).

`apps/app/.env.example`: código completo en [`../assets/config/env.app.example`](../assets/config/env.app.example).

`apps/web/.env.example`:
```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_PROJECT_SLUG=

# Observabilidad
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
```

### instrumentation.ts — OTel agnóstico

`apps/app/instrumentation.ts` y `apps/web/instrumentation.ts`:
```typescript
// OTel — agnóstico de backend. Destino vía OTEL_EXPORTER_OTLP_ENDPOINT.
// Completar con skill alyp-observability para configurar el backend.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({
      serviceName: process.env.SERVICE_NAME ?? process.env.NEXT_PUBLIC_PROJECT_SLUG ?? "app",
    });
  }
}
```

Agregar `@vercel/otel` a devDependencies de cada app.

### layout.tsx raíz

`apps/app/src/app/layout.tsx`: código completo en [`../assets/app/layout.tsx`](../assets/app/layout.tsx).

### Vercel — 2 proyectos (referencia para FASE 5)

Build commands:
```
# apps/web
cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/web

# apps/app
cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/app
```

---

## FASE 3B — Next.js simple (`USE_TURBOREPO=false`)

Sin `turbo.json` ni `pnpm-workspace.yaml`. Sin `PACKAGE_SCOPE`.

**Estructura**:
```
$PROJECT_SLUG/
├── src/
│   ├── app/
│   ├── lib/supabase/server.ts
│   └── middleware.ts
├── supabase/migrations/
├── scripts/
├── .github/
├── package.json
├── tsconfig.json
├── next.config.ts        # con security headers
└── instrumentation.ts
```

`package.json`: código completo en [`../assets/config/package.simple.json`](../assets/config/package.simple.json).

Usar los mismos `tsconfig.json`, `next.config.ts` (con security headers), `middleware.ts`, `instrumentation.ts` y `.env.example` que 3A — adaptados a la ruta `src/` sin workspace scope.

Crear también los stubs de logging con rutas equivalentes:
- `src/utils/logger.ts` — mismo contenido que el stub de 3A
- `src/utils/error-codes.ts` — mismo contenido que el stub de 3A

> FASE 5.5 (`alyp-observability`) reemplazará estos stubs con la implementación completa.

1 proyecto Vercel con build command `pnpm run build` y root directory en raíz.
