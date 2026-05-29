# Alyp Studio — New Project Setup

Skill orquestador para crear proyectos SaaS enterprise con el stack de Alyp Studio.
Delega fases especializadas a skills dedicados — no reinventa lo que ya está resuelto.

**Stack**: Turborepo · Next.js (última estable) · Supabase · Vercel · GitHub
**Principio**: agnóstico por defecto — toda integración de plataforma vía env var estándar o protocolo abierto (OTel, OTLP).

Ejecuta cada fase en orden. Anuncia el inicio de cada fase. Si algo falla, diagnostica antes de continuar.

---

## FASE 0 — Pre-flight

Verificar herramientas y autenticación. **Fallar rápido** antes de crear recursos.

```bash
# Versiones mínimas
gh --version        # GitHub CLI — debe estar autenticado
vercel --version    # Vercel CLI — debe estar autenticado
pnpm --version      # >= 9
node --version      # >= 22
supabase --version  # Supabase CLI

# Scopes del token de GitHub (necesita repo + admin:org para branch protection y secrets)
gh auth status

# Identidad Vercel
vercel whoami

# Identidad git
git config --global user.name   # pablopr
git config --global user.email  # pr@pablorodriguezb.com
```

Si git no coincide, corregir:
```bash
git config --global user.name "pablopr"
git config --global user.email "pr@pablorodriguezb.com"
```

**Gate de salida**: todas las herramientas disponibles y autenticadas. No continuar si falla gh o vercel.

---

## FASE 1 — Arquitectura del proyecto

### 1.1 Recopilar variables

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

### 1.2 Decisión: ¿Turborepo o Next.js simple?

| Escenario | `USE_TURBOREPO` |
|-----------|----------------|
| 2+ apps (web marketing + app transaccional, frontend + backend API) | `true` |
| 1 app + segunda app planeada en < 6 meses | `true` |
| 1 app + expansión > 6 meses o indefinida | `false` |
| 1 app + sin planes de segunda app | `false` |

Anotar `USE_TURBOREPO=true|false`. Esta variable gobierna FASE 3, FASE 5 y el CI.

### 1.3 Decisión: ¿Multi-tenancy intra-app?

| Escenario | `USE_MULTITENANCY` |
|-----------|-------------------|
| El SaaS tiene organizaciones / equipos / cuentas empresa | `true` |
| Single-tenant (1 empresa, 1 instancia) | `false` |

Anotar `USE_MULTITENANCY=true|false`. Controla FASE 3.5.

---

## FASE 2 — Repositorio GitHub

```bash
gh repo create alyp-studio/$PROJECT_SLUG \
  --private \
  --description "$CLIENT_NAME — Plataforma SaaS" \
  --clone \
  --gitignore Node

cd $BASE_DIR/$PROJECT_SLUG

# Ramas
git checkout -b develop && git push origin develop
git checkout -b staging  && git push origin staging
git checkout develop
```

Crear `.github/CODEOWNERS`:

```
# Revisión requerida en todo cambio
* @pablopr @alyp-studio

# Archivos críticos — solo @pablopr
supabase/migrations/    @pablopr
.github/workflows/      @pablopr
vercel.json             @pablopr
turbo.json              @pablopr
```

**Gate de salida**: repo creado, 3 ramas en origin, CODEOWNERS commiteado.

---

## FASE 2b — CI Workflow + Branch Protection

> Ejecutar inmediatamente después de FASE 2. El workflow debe existir en el repo ANTES de configurar status checks, o quedarán en estado pendiente permanente.

### CI Workflow

Crear `.github/workflows/ci.yml` (commitear a `develop` y pushear antes de continuar):

**Variante Turborepo** (`USE_TURBOREPO=true`):
```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-lint-typecheck:
    name: Build, Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        # NO especificar version: — lee packageManager de package.json automáticamente

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Verify (typecheck + lint + test)
        run: pnpm turbo run verify

      - name: Build
        run: pnpm turbo run build

      - name: Security audit
        run: pnpm audit --audit-level=high
```

**Variante simple** (`USE_TURBOREPO=false`): reemplazar los steps de verify y build por `pnpm run verify` y `pnpm run build` respectivamente. El job se llama igual (`Build, Lint & Typecheck`) — la branch protection no cambia.

### Branch protection

```bash
# main — máxima protección
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/main/protection \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Build, Lint & Typecheck" }]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# staging — protección media
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/staging/protection \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Build, Lint & Typecheck" }]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# develop — solo bloquear borrado y force push
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/develop/protection \
  --input - << 'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

### 2b.3 Secrets de GitHub requeridos

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

---

## FASE 3 — Scaffold

Obtener la versión estable actual de Next.js antes de escribir cualquier package.json:
```bash
NEXT_VERSION=$(npm show next dist-tags.latest)
echo "Next.js estable: $NEXT_VERSION"
```

Nunca hardcodear una versión — Vercel bloquea versiones con vulnerabilidades conocidas.

---

### FASE 3A — Turborepo (`USE_TURBOREPO=true`)

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

**`package.json` raíz**:
```json
{
  "name": "$PROJECT_SLUG",
  "private": true,
  "scripts": {
    "build":     "turbo build",
    "dev":       "turbo dev",
    "lint":      "turbo lint",
    "typecheck": "turbo typecheck",
    "format":    "prettier --write \"**/*.{ts,tsx,md,json}\" --ignore-path .gitignore"
  },
  "devDependencies": {
    "prettier": "^3.5.3",
    "turbo":    "^2.5.4"
  },
  "packageManager": "pnpm@9.15.4"
}
```

**`pnpm-workspace.yaml`**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs":    ["$TURBO_DEFAULT$", ".env*"],
      "outputs":   [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev":       { "cache": false, "persistent": true },
    "lint":      { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "format":    { "outputs": [] }
  }
}
```

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

#### tsconfig — SIEMPRE auto-contenido por app

NUNCA extender desde `packages/config` — causa errores de resolución en Vercel.

`apps/web/tsconfig.json` y `apps/app/tsconfig.json` (idénticos):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "lib":                        ["DOM", "DOM.Iterable", "ES2022"],
    "module":                     "ESNext",
    "moduleResolution":           "Bundler",
    "jsx":                        "preserve",
    "plugins":                    [{ "name": "next" }],
    "allowImportingTsExtensions": true,
    "noEmit":                     true,
    "strict":                     true,
    "esModuleInterop":            true,
    "skipLibCheck":               true,
    "resolveJsonModule":          true,
    "isolatedModules":            true,
    "incremental":                true,
    "baseUrl":                    ".",
    "paths":                      { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### next.config.ts — con security headers base

`apps/web/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options",     value: "nosniff" },
  { key: "X-Frame-Options",            value: "DENY" },
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  transpilePackages: ["@$PACKAGE_SCOPE/ui"],
  reactStrictMode: true,
  experimental: { ppr: "incremental" },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
export default config;
```

`apps/app/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options",     value: "nosniff" },
  { key: "X-Frame-Options",            value: "DENY" },
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  transpilePackages: ["@$PACKAGE_SCOPE/ui", "@$PACKAGE_SCOPE/database"],
  reactStrictMode: true,
  experimental: { ppr: "incremental" },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
export default config;
```

#### package.json de cada app

`apps/app/package.json`:
```json
{
  "name": "@$PACKAGE_SCOPE/app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build":     "next build",
    "dev":       "next dev --port 3001",
    "lint":      "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@$PACKAGE_SCOPE/ui":         "workspace:*",
    "@$PACKAGE_SCOPE/database":   "workspace:*",
    "@hookform/resolvers":        "^3.10.0",
    "@supabase/ssr":              "^0.6.1",
    "@supabase/supabase-js":      "^2.49.4",
    "@t3-oss/env-nextjs":         "^0.11.1",
    "@tanstack/react-query":      "^5.75.5",
    "next":                       "<NEXT_VERSION>",
    "react":                      "^19.0.0",
    "react-dom":                  "^19.0.0",
    "react-hook-form":            "^7.56.3",
    "zod":                        "^3.24.4"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.75.5",
    "@types/node":       "^22.0.0",
    "@types/react":      "^19.0.0",
    "@types/react-dom":  "^19.0.0",
    "tailwindcss":       "^4.1.6",
    "typescript":        "^5.8.3"
  }
}
```

`apps/web/package.json`:
```json
{
  "name": "@$PACKAGE_SCOPE/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build":     "next build",
    "dev":       "next dev --port 3000",
    "lint":      "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@$PACKAGE_SCOPE/ui": "workspace:*",
    "next":               "<NEXT_VERSION>",
    "react":              "^19.0.0",
    "react-dom":          "^19.0.0"
  },
  "devDependencies": {
    "@types/node":      "^22.0.0",
    "@types/react":     "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss":      "^4.1.6",
    "typescript":       "^5.8.3"
  }
}
```

#### Supabase client — tipos explícitos SIEMPRE

`apps/app/src/lib/supabase/server.ts`:
```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@$PACKAGE_SCOPE/database";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

// Cliente admin (server-only) — NUNCA exponer al cliente
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
```

#### Logging y error codes — instalación base

Crear `apps/app/src/utils/logger.ts` y `apps/app/src/utils/error-codes.ts` como parte del scaffold.

> Nota: el contenido completo de estos archivos lo instala el skill `alyp-observability` en FASE 5.5.
> Aquí solo se crean los stubs tipados para que el código generado por `new-feature.mjs` compile desde el día 1.

`apps/app/src/utils/logger.ts` (stub):
```typescript
// Stub — reemplazar con instalación completa via skill alyp-observability
export type Nivel = 'debug' | 'info' | 'warn' | 'error';
export interface ContextoLog { traceId: string; contexto: string; codigo?: string; [k: string]: unknown; }
export const agenticLogger = {
  error: (_ctx: ContextoLog, _err: unknown) => {},
  warn:  (_ctx: ContextoLog, _msg?: string) => {},
  info:  (_ctx: ContextoLog, _msg?: string) => {},
  debug: (_ctx: ContextoLog, _msg?: string) => {},
};
export function nuevoTraceId(): string { return `tr_${Date.now()}_${Math.random().toString(36).slice(2,10)}`; }
export function crearLoggerDeRuta(traceId: string, contexto: string, meta: Record<string,unknown> = {}) {
  const base = (): ContextoLog => ({ traceId, contexto, ...meta });
  return {
    traceId,
    info:  (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.info({ ...base(), ...m }, msg),
    warn:  (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.warn({ ...base(), ...m }, msg),
    debug: (msg?: string, m: Record<string,unknown> = {}) => agenticLogger.debug({ ...base(), ...m }, msg),
    error: (err: unknown, ex: { codigo?: string; [k: string]: unknown } = {}) => agenticLogger.error({ ...base(), ...ex }, err),
  };
}
```

`apps/app/src/utils/error-codes.ts` (stub):
```typescript
// Stub — reemplazar con instalación completa via skill alyp-observability
export const CODIGOS = {
  ERR_NEGOCIO_GENERICO: 'ERR_NEGOCIO_GENERICO',
  ERR_VALIDACION: 'ERR_VALIDACION',
  ERR_NO_AUTORIZADO: 'ERR_NO_AUTORIZADO',
  REGLA_RLS_VIOLADA: 'REGLA_RLS_VIOLADA',
  REGISTRO_NO_ENCONTRADO: 'REGISTRO_NO_ENCONTRADO',
  VIOLACION_UNICIDAD: 'VIOLACION_UNICIDAD',
  VIOLACION_LLAVE_FORANEA: 'VIOLACION_LLAVE_FORANEA',
} as const;
export type CodigoError = keyof typeof CODIGOS;
export function mapearCodigoPostgres(code?: string): CodigoError {
  switch (code) {
    case '42501': return 'REGLA_RLS_VIOLADA';
    case '23505': return 'VIOLACION_UNICIDAD';
    case '23503': return 'VIOLACION_LLAVE_FORANEA';
    case 'PGRST116': return 'REGISTRO_NO_ENCONTRADO';
    default: return 'ERR_NEGOCIO_GENERICO';
  }
}
```

> FASE 5.5 (`alyp-observability`) reemplazará estos stubs con la implementación completa (honeypot, PII scrub, niveles, etc.).

#### Edge vs Node runtime — regla de seguridad

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

`apps/app/src/middleware.ts`:
```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  if (request.nextUrl.pathname.startsWith("/auth") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
```

#### packages/ui — shadcn/ui base

`packages/ui/package.json`:
```json
{
  "name": "@$PACKAGE_SCOPE/ui",
  "version": "0.1.0",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@radix-ui/react-avatar":    "^1.1.10",
    "@radix-ui/react-label":     "^2.1.7",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slot":      "^1.2.3",
    "class-variance-authority":  "^0.7.1",
    "clsx":                      "^2.1.1",
    "lucide-react":              "^0.511.0",
    "sonner":                    "^2.0.3",
    "tailwind-merge":            "^3.3.0"
  }
}
```

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

#### packages/database

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

#### packages/config — ESLint + Prettier + Tailwind shared

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

#### Providers y validación de env

`apps/app/src/providers/query-provider.tsx`:
```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// DevTools solo en desarrollo — NO en bundle de producción
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? require("@tanstack/react-query-devtools").ReactQueryDevtools
    : () => null;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

`apps/app/src/lib/env.ts`:
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SERVICE_NAME:              z.string().min(1).default('app'),
    LOG_LEVEL:                 z.enum(['debug','info','warn','error']).default('info'),
    LOG_PROVIDER:              z.enum(['local','axiom','http']).default('local'),
    LOG_PROVIDER_API_URL:      z.string().url().optional(),
    LOG_PROVIDER_TOKEN:        z.string().optional(),
    LOG_DATASET:               z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS:  z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WEB_URL:           z.string().url().optional(),
    NEXT_PUBLIC_PROJECT_SLUG:      z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
    SERVICE_NAME:              process.env.SERVICE_NAME,
    LOG_LEVEL:                 process.env.LOG_LEVEL,
    LOG_PROVIDER:              process.env.LOG_PROVIDER,
    LOG_PROVIDER_API_URL:      process.env.LOG_PROVIDER_API_URL,
    LOG_PROVIDER_TOKEN:        process.env.LOG_PROVIDER_TOKEN,
    LOG_DATASET:               process.env.LOG_DATASET,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS:  process.env.OTEL_EXPORTER_OTLP_HEADERS,
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WEB_URL:           process.env.NEXT_PUBLIC_WEB_URL,
    NEXT_PUBLIC_PROJECT_SLUG:      process.env.NEXT_PUBLIC_PROJECT_SLUG,
  },
});
```

`apps/app/.env.example`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only — NUNCA exponer al cliente

# Database (para migraciones y ORM directo)
DATABASE_URL=                     # pooler Supabase puerto 6543 modo transaction
DIRECT_URL=                       # conexión directa puerto 5432 (solo migraciones)

# URLs
NEXT_PUBLIC_WEB_URL=
NEXT_PUBLIC_PROJECT_SLUG=

# Observabilidad (OTel — agnóstico de backend)
OTEL_EXPORTER_OTLP_ENDPOINT=     # https://... (Grafana, Honeycomb, Datadog, self-hosted Jaeger...)
OTEL_EXPORTER_OTLP_HEADERS=      # Authorization=Bearer xxx
```

`apps/web/.env.example`:
```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_PROJECT_SLUG=

# Observabilidad
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
```

#### instrumentation.ts — OTel agnóstico

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

#### layout.tsx raíz

`apps/app/src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Toaster } from "@$PACKAGE_SCOPE/ui";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = { title: "$CLIENT_NAME" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
```

#### Vercel — 2 proyectos (referencia para FASE 5)

Build commands:
```
# apps/web
cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/web

# apps/app
cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/app
```

---

### FASE 3B — Next.js simple (`USE_TURBOREPO=false`)

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

`package.json`:
```json
{
  "name": "$PROJECT_SLUG",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build":     "next build",
    "dev":       "next dev",
    "lint":      "next lint",
    "typecheck": "tsc --noEmit",
    "format":    "prettier --write \"**/*.{ts,tsx,md,json}\" --ignore-path .gitignore"
  },
  "dependencies": {
    "@hookform/resolvers":   "^3.10.0",
    "@supabase/ssr":         "^0.6.1",
    "@supabase/supabase-js": "^2.49.4",
    "@t3-oss/env-nextjs":    "^0.11.1",
    "@tanstack/react-query": "^5.75.5",
    "@vercel/otel":          "^1.0.0",
    "next":                  "<NEXT_VERSION>",
    "react":                 "^19.0.0",
    "react-dom":             "^19.0.0",
    "react-hook-form":       "^7.56.3",
    "zod":                   "^3.24.4"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.75.5",
    "@types/node":      "^22.0.0",
    "@types/react":     "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "prettier":         "^3.5.3",
    "tailwindcss":      "^4.1.6",
    "typescript":       "^5.8.3"
  },
  "packageManager": "pnpm@9.15.4"
}
```

Usar los mismos `tsconfig.json`, `next.config.ts` (con security headers), `middleware.ts`, `instrumentation.ts` y `.env.example` que 3A — adaptados a la ruta `src/` sin workspace scope.

Crear también los stubs de logging con rutas equivalentes:
- `src/utils/logger.ts` — mismo contenido que el stub de 3A
- `src/utils/error-codes.ts` — mismo contenido que el stub de 3A

> FASE 5.5 (`alyp-observability`) reemplazará estos stubs con la implementación completa.

1 proyecto Vercel con build command `pnpm run build` y root directory en raíz.

---

## FASE 3.5 — Agentic-Ready Standards (delegado)

> Invocar el skill `alyp-agentic-standards` en modo **bootstrap** con este contexto:

**Tarea**: aplicar el estándar agentic-ready v1 al proyecto `$PROJECT_SLUG`.
- Actualizar `tsconfig.json` de `apps/app` (y `apps/web` si existe) con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`
- Agregar script `verify` (typecheck + lint + test), `new-feature`, `supabase:gen`, `supabase:gen:local` al `package.json` de la app
- Crear estructura `src/features/` (vacía — se puebla por dominio cuando se implementen features)
- Crear `src/types/database.types.ts` placeholder
- Crear `scripts/new-feature.mjs` (generador de features)
- Instalar Vitest + `vitest.config.ts`
- Configurar ESLint: `no-restricted-imports` entre features + `no-console` + `no-empty`
- Generar `CLAUDE.md` slim con sello `<!-- agentic-standard: v1 -->`

**Gate de salida**: `pnpm verify` pasa limpio. `pnpm new-feature test` crea `src/features/test/` con 6 archivos. `CLAUDE.md` tiene sello de versión.

---

## FASE 3.6 — Data Layer & Tenancy

### RLS deny-by-default (SIEMPRE, todo proyecto)

Crear `supabase/migrations/0001_rls_baseline.sql`:
```sql
-- Habilitar RLS en todas las tablas existentes — política base: denegar todo
-- Cada tabla necesita políticas explícitas para ser accesible
-- Gate: supabase/migrations/ debe tener 0 tablas sin RLS antes de deploy a PROD

-- Plantilla para cada tabla nueva:
-- ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated can read own" ON public.mi_tabla
--   FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### Multi-tenancy base (solo si `USE_MULTITENANCY=true`)

Crear `supabase/migrations/0002_tenancy.sql`:
```sql
-- Organizaciones
CREATE TABLE public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Membresías con roles
CREATE TABLE public.memberships (
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX ON public.memberships(user_id);
CREATE INDEX ON public.memberships(org_id);

-- Helper sin recursión para RLS
CREATE OR REPLACE FUNCTION auth.user_orgs()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
$$;

-- Audit log
CREATE TABLE public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES public.organizations(id),
  actor_id   uuid REFERENCES auth.users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read own org" ON public.organizations
  FOR SELECT TO authenticated USING (id IN (SELECT auth.user_orgs()));

CREATE POLICY "members can read own memberships" ON public.memberships
  FOR SELECT TO authenticated USING (org_id IN (SELECT auth.user_orgs()));

CREATE POLICY "members can read own audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (org_id IN (SELECT auth.user_orgs()));
```

Helper server-side en `src/lib/auth/require-role.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "owner" | "admin" | "member" | "viewer";

export async function requireRole(orgId: string, allowedRoles: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !allowedRoles.includes(membership.role as Role)) {
    redirect("/dashboard?error=forbidden");
  }
  return { user, role: membership.role as Role };
}
```

### Seed local

Crear `supabase/seed.sql` para que `supabase db reset` no deje la DB vacía:

```sql
-- supabase/seed.sql
-- Datos mínimos para desarrollo local. No commitear datos sensibles reales.

-- Organización de prueba (solo si USE_MULTITENANCY=true)
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Org Demo', 'org-demo')
ON CONFLICT (id) DO NOTHING;

-- Nota: los usuarios de auth se crean via Supabase Auth UI o scripts de seed separados.
-- Ver: supabase/seed-users.md para el flujo de creación de usuarios de prueba.
```

### Trigger: poblar memberships al signup (si USE_MULTITENANCY=true)

Sin este trigger, el primer usuario que se registra no tiene `membership` y todas las RLS policies lo bloquean.

Crear `supabase/migrations/0003_auth_trigger.sql`:

```sql
-- Función que crea el perfil y membership inicial al registrarse un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Si el usuario viene con metadata de org_id (invite flow), unirse a esa org
  -- Si no, crear una org personal
  v_org_id := (NEW.raw_user_meta_data->>'org_id')::uuid;

  IF v_org_id IS NULL THEN
    -- Crear org personal
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'personal-' || substr(NEW.id::text, 1, 8)
    )
    RETURNING id INTO v_org_id;

    -- Primer usuario = owner
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'owner');
  ELSE
    -- Unirse a org existente como member (el invite flow asigna el rol real)
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Disparar al crear usuario en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

> Nota: este trigger solo aplica si `USE_MULTITENANCY=true`. Si es single-tenant, omitir.

---

## FASE 3.6 — App Shell & Resilience

Crear en `apps/app/src/app/`:

`error.tsx`:
```typescript
"use client";
import { useEffect } from "react";
import { Button } from "@$PACKAGE_SCOPE/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // TODO: reportar a sistema de observabilidad cuando alyp-observability esté listo
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Algo salió mal</h2>
      <Button onClick={reset} variant="outline">Reintentar</Button>
    </div>
  );
}
```

`global-error.tsx` — idéntico a `error.tsx` pero para el layout raíz.

`not-found.tsx`:
```typescript
import Link from "next/link";
import { Button } from "@$PACKAGE_SCOPE/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Página no encontrada</h2>
      <Button asChild><Link href="/dashboard">Volver al inicio</Link></Button>
    </div>
  );
}
```

`loading.tsx`:
```typescript
import { Skeleton } from "@$PACKAGE_SCOPE/ui";

export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
```

Health endpoint `apps/app/src/app/api/health/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: "error", error: String(err) }, { status: 503 });
  }
}
```

---

## FASE 4 — Supabase (delegado)

> Invocar el skill `supabase:supabase` con este contexto:

**Tarea**: crear 3 proyectos Supabase para este proyecto.

```
# 3 proyectos — uno por ambiente real:

# DEV — para ambiente de develop (desarrollo activo)
# create_project → nombre: $PROJECT_SLUG-dev, region: us-east-1

# STAGING — para validación pre-prod (staging/QA)
# create_project → nombre: $PROJECT_SLUG-staging, region: us-east-1

# PROD — producción
# create_project → nombre: $PROJECT_SLUG-prod, region: us-east-1
```

- Obtener `URL`, `anon key` y `service_role key` de cada uno
- Obtener `DATABASE_URL` (pooler, puerto 6543) y `DIRECT_URL` (puerto 5432) de cada uno

> Luego invocar `supabase:supabase-postgres-best-practices` para revisar:
> - Configuración de connection pooling
> - Índices obligatorios sobre columnas de RLS y FKs de tenant
> - Activar leaked-password protection en Auth settings

Anotar en sesión:
- `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE`
- `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE`
- `SUPABASE_PROD_URL`, `SUPABASE_PROD_ANON_KEY`, `SUPABASE_PROD_SERVICE_ROLE`
- `DATABASE_URL_DEV`, `DIRECT_URL_DEV`
- `DATABASE_URL_STAGING`, `DIRECT_URL_STAGING`
- `DATABASE_URL_PROD`, `DIRECT_URL_PROD`

Crear `supabase/config.toml`:
```toml
[api]
port = 54321

[db]
port = 54322

[studio]
port = 54323

[auth]
site_url = "http://127.0.0.1:3001"
additional_redirect_urls = ["http://localhost:3001"]
```

Crear `.env.local` en `apps/app/` con las keys DEV (ambiente de desarrollo activo). No commitear.

Aplicar migraciones de FASE 3.5 al proyecto DEV:
```bash
supabase db push --db-url $DIRECT_URL_DEV
```

Ejecutar advisors y verificar que no haya tablas sin RLS:
```bash
# Via MCP: mcp__plugin_supabase_supabase__get_advisors → revisar security advisors
```

**Gate de salida**: 3 proyectos ACTIVE_HEALTHY (dev, staging, prod), migraciones aplicadas en DEV, 0 tablas sin RLS en advisor.

---

## FASE 5 — Vercel (delegado)

> Invocar el skill `vercel:bootstrap` con este contexto:

**Tarea**: configurar proyectos Vercel para `$PROJECT_SLUG`.
- Team: `$VERCEL_TEAM_SLUG` / `$VERCEL_TEAM_ID`
- GitHub org: `alyp-studio`, repo: `$PROJECT_SLUG`
- Si `USE_TURBOREPO=true`: crear 2 proyectos (`$PROJECT_SLUG-web`, `$PROJECT_SLUG-app`)
  - `web`: rootDirectory `apps/web`, buildCommand `cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/web`
  - `app`: rootDirectory `apps/app`, buildCommand `cd ../.. && pnpm turbo run build --filter=@$PACKAGE_SCOPE/app`
- Si `USE_TURBOREPO=false`: 1 proyecto (`$PROJECT_SLUG`), root en raíz, buildCommand `pnpm run build`

> Luego invocar `vercel:env-vars` para configurar las variables por entorno:

Para `$PROJECT_SLUG-app` (o el único proyecto en modo simple):
```
NEXT_PUBLIC_SUPABASE_URL      → development: DEV | preview (branch develop/*): DEV | preview (branch staging): STAGING | production: PROD
NEXT_PUBLIC_SUPABASE_ANON_KEY → development: DEV | preview develop: DEV | preview staging: STAGING | production: PROD
SUPABASE_SERVICE_ROLE_KEY     → (mismo patrón)
DATABASE_URL                  → (mismo patrón con poolers)
LOG_PROVIDER                  → development: local | preview develop: local | preview staging: http | production: http
SERVICE_NAME                  → $PROJECT_SLUG (todos los entornos)
NEXT_PUBLIC_PROJECT_SLUG      → $PROJECT_SLUG (todos los entornos)
OTEL_EXPORTER_OTLP_ENDPOINT   → (vacío — completar con alyp-observability)
OTEL_EXPORTER_OTLP_HEADERS    → (vacío — completar con alyp-observability)
```

> Vercel permite env vars específicas por Git Branch en previews: usar "Preview (branch: staging)"
> para distinguir staging de develop sin afectar el scope general de preview.
> Configurar vía API: PATCH /v9/projects/{id}/env con gitBranch: "staging"

Desactivar SSO protection para previews:
```bash
# PATCH /v9/projects/{projectId} → { "ssoProtection": null }
# Hacer para cada proyecto
```

### 5.6 Configurar Vercel Log Drain (observabilidad en producción)

Sin Log Drain, los logs JSON de la app **no persisten en producción** — el filesystem de Vercel es efímero.

```bash
# Opción A: Via Vercel Marketplace (recomendado)
# Dashboard → Integrations → buscar proveedor (Axiom, Datadog, Logtail, etc.)
# Conectar el proyecto y configurar el drain automáticamente

# Opción B: Via API (para cualquier endpoint HTTP)
curl -X POST "https://api.vercel.com/v1/integrations/log-drains" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-drain-endpoint.com/logs",
    "sources": ["build", "edge", "external", "static"],
    "deliveryFormat": "json",
    "projectIds": ["prj_xxx"]
  }'
```

Variables de entorno a agregar en Vercel (para el extractor agent-gps):
```
LOG_PROVIDER_API_URL=   # endpoint del drain o backend de logs
LOG_PROVIDER_TOKEN=     # token de autenticación
LOG_DATASET=            # nombre del dataset/índice
```

> Nota: `LOG_PROVIDER=local` solo funciona en `next dev` local. En Vercel (cualquier ambiente),
> usar `http` o el proveedor específico. `local` en serverless descarta los logs.

**Gate de salida**: proyectos creados, GitHub linkeado, env vars configuradas por entorno.

---

## FASE 5.5 — Observabilidad (delegado)

> Invocar el skill `alyp-observability`.

**PLACEHOLDER** — El skill `alyp-observability` está en construcción.
Por ahora: el `instrumentation.ts` ya creado en FASE 3 sirve como base. Las env vars `OTEL_EXPORTER_*` ya están en `.env.example` y Vercel como placeholders.

Completar esta fase cuando el skill esté disponible.

---

## FASE 5.6 — Rate Limiting & Seguridad de tráfico (delegado)

> Invocar el skill `vercel:vercel-firewall` con contexto:

**Tarea**: configurar rate limiting para `$PROJECT_SLUG-app`.
- Endpoints críticos a proteger: `/api/`, `/auth/`, Server Actions
- Objetivo: prevenir abuso de auth y APIs públicas

---

## FASE 5.7 — Performance & Caching (delegado)

> Invocar el skill `vercel:next-cache-components` con contexto:

**Tarea**: configurar estrategia de caching para `$PROJECT_SLUG`.
- PPR ya habilitado en `next.config.ts` (`ppr: "incremental"`)
- Revisar rutas de `apps/web` — deben ser SSG/ISR por defecto (marketing estático)
- Configurar `use cache` / `cacheTag` / `revalidateTag` para queries de Supabase reutilizables
- Revisar que ningún RSC en `apps/web` use cookies (lo volvería dinámico)

---

## FASE 6 — Primer commit y deploy

```bash
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
```

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

---

## FASE 7 — Documentación

Crear `docs/CONFIGURACION.md` con:
- Descripción del proyecto y cliente
- Arquitectura elegida (Turborepo/simple, multi-tenancy/no)
- IDs de servicios: Supabase DEV/PROD project IDs, Vercel project IDs, GitHub repo
- Variables de entorno por entorno (sin valores secretos)
- Comandos de desarrollo
- Decisiones técnicas tomadas y por qué
- Pendientes

Guardar memoria del proyecto:
```
~/.claude/projects/-Users-parb/memory/project_$PROJECT_SLUG.md
```

Actualizar `MEMORY.md` con entrada del nuevo proyecto.

---

## FASE 8 — Sistema de Contexto Automático (Auto-Context)

El sistema mantiene `CLAUDE.md` y `memory/*.md` actualizados via GitHub Actions.

### 8.1 Crear `scripts/generate-context.js`

Script que analiza el codebase y genera:
- `CLAUDE.md` en raíz con protocolo de uso para Claude Code, módulos, schema DB, reglas
- `memory/<módulo>.md` por cada módulo con dependencias y co-change patterns

El script preserva las secciones `<!-- MANUAL -->` del `CLAUDE.md` en cada regeneración.

### 8.2 Crear `.github/workflows/update-context.yml`

Workflow que se dispara en push a `main`/`develop`/`staging`, regenera CLAUDE.md + memory/*.md, y hace commit automático con `[skip ci]`.

En PRs: comenta el diff de contexto en el PR.

### 8.3 Registrar `CONTEXT_BOT_TOKEN`

```bash
# Forma recomendada — pide el valor interactivamente
gh secret set CONTEXT_BOT_TOKEN --repo alyp-studio/$PROJECT_SLUG
```

### 8.4 Generar contexto inicial

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

---

## Checklist final

### Común a ambas variantes

- [ ] Variables de FASE 1 anotadas (`PROJECT_SLUG`, `USE_TURBOREPO`, `USE_MULTITENANCY`)
- [ ] Repo GitHub privado creado
- [ ] Ramas `main`, `staging`, `develop` en origin
- [ ] `.github/CODEOWNERS` commiteado
- [ ] `.github/workflows/ci.yml` en `develop` — include `pnpm audit --audit-level=high`
- [ ] Branch protection: `main` (strict + 1 review + enforce_admins), `staging` (strict + 1 review), `develop` (no-force, no-delete)
- [ ] Security headers en `next.config.ts` (HSTS, X-Frame, X-Content-Type, Referrer, Permissions)
- [ ] PPR habilitado (`ppr: "incremental"`) en `next.config.ts`
- [ ] `tsconfig.json` auto-contenido con `baseUrl`, `paths`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [ ] Next.js en versión estable actual (verificada con `npm show next dist-tags.latest`)
- [ ] **Agentic-Ready:** `pnpm verify` script creado y pasa limpio
- [ ] **Agentic-Ready:** `scripts/new-feature.mjs` creado y funciona
- [ ] **Agentic-Ready:** `src/features/` + `src/types/database.types.ts` presentes
- [ ] **Agentic-Ready:** Vitest instalado + `vitest.config.ts`
- [ ] **Agentic-Ready:** ESLint con `no-restricted-imports` entre features
- [ ] **Agentic-Ready:** `CLAUDE.md` slim con sello `agentic-standard: v1`
- [ ] **Agentic-Ready:** `pnpm supabase:gen` y `pnpm supabase:gen:local` en scripts
- [ ] `CookieOptions` tipado explícitamente en `server.ts` y `middleware.ts`
- [ ] `createAdminClient()` con `SERVICE_ROLE_KEY` (server-only)
- [ ] `utils/logger.ts` y `utils/error-codes.ts` stubs creados en scaffold (FASE 3A)
- [ ] `env.ts` valida variables de observabilidad (SERVICE_NAME, LOG_LEVEL, LOG_PROVIDER, etc.)
- [ ] `instrumentation.ts` creado (OTel placeholder)
- [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` en `.env.example` y Vercel como placeholder
- [ ] 3 proyectos Supabase (dev + staging + prod) en estado ACTIVE_HEALTHY
- [ ] `DATABASE_URL` (pooler 6543) y `DIRECT_URL` (5432) configurados
- [ ] Leaked-password protection activada en Supabase Auth
- [ ] `supabase/migrations/0001_rls_baseline.sql` commiteado
- [ ] RLS advisor: 0 tablas sin RLS antes de deploy a PROD
- [ ] `.env.local` con keys DEV (no commiteado)
- [ ] Secrets de GitHub configurados: CONTEXT_BOT_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF_DEV/PROD
- [ ] GitHub App de Vercel con acceso al repo
- [ ] Vercel env vars por git branch (develop → DEV, staging → STAGING, main → PROD)
- [ ] LOG_PROVIDER=local SOLO en machine local — staging y prod usan LOG_PROVIDER=http
- [ ] Vercel Log Drain configurado para staging y production
- [ ] SSO protection desactivada para previews
- [ ] `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` creados
- [ ] `/api/health` retorna `{ "status": "ok" }` en el deploy
- [ ] Primer deploy en estado `READY`
- [ ] `docs/CONFIGURACION.md` commiteado
- [ ] Memoria Claude guardada y `MEMORY.md` actualizado
- [ ] Auto-Context: `generate-context.js` + `update-context.yml` + `CONTEXT_BOT_TOKEN`
- [ ] Auto-Context: `CLAUDE.md` generado, secciones `<!-- MANUAL -->` llenadas

### Solo si `USE_TURBOREPO=true`

- [ ] `turbo.json`, `pnpm-workspace.yaml` presentes
- [ ] `packages/ui`, `packages/database`, `packages/config` scaffoldeados
- [ ] 2 proyectos Vercel (`-web`, `-app`) con build commands turbo filter
- [ ] `ReactQueryDevtools` solo en bundle de desarrollo (no en producción)

### Solo si `USE_TURBOREPO=false`

- [ ] Sin `turbo.json` ni `pnpm-workspace.yaml`
- [ ] 1 proyecto Vercel, root directory en raíz
- [ ] CI workflow usa `pnpm run build/lint/typecheck` (sin turbo)

### Solo si `USE_MULTITENANCY=true`

- [ ] `supabase/migrations/0002_tenancy.sql` con `organizations`, `memberships`, `audit_log`
- [ ] `auth.user_orgs()` helper sin recursión creado
- [ ] `require-role.ts` helper en `src/lib/auth/`
- [ ] Índices sobre `memberships(user_id)` y `memberships(org_id)`
- [ ] `supabase/migrations/0003_auth_trigger.sql` con trigger on_auth_user_created
- [ ] `supabase/seed.sql` con org y datos mínimos de prueba

### Skills pendientes de completar

- [ ] `alyp-observability` — FASE 5.5 pendiente de completar el skill
- [ ] Rate limiting (FASE 5.6) — invocar `vercel:vercel-firewall` al terminar el scaffold
- [ ] Performance/caching (FASE 5.7) — invocar `vercel:next-cache-components` en primera iteración de features
