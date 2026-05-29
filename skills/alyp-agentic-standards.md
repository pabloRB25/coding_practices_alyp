# Alyp Studio — Agentic-Ready Standards

Skill que aplica el estándar de código "agentic-ready" en proyectos Alyp Studio.
Optimiza el ciclo del agente: **LEER → ENTENDER → CAMBIAR → VERIFICAR**.

**Versión del estándar**: `agentic-standard: v1`
**Principio**: lo que abarata cada paso del ciclo sube la tasa de éxito y baja el consumo de tokens.

| Paso | Qué lo abarata |
|------|----------------|
| Leer | Co-localización por feature, nombres predecibles, archivos pequeños |
| Entender | Tipos estrictos, contratos Zod, env tipado, compilador como documentación |
| Cambiar | Generador de features, barrels, límites de módulo, commits atómicos |
| **Verificar** | **`pnpm verify` determinista + CI espejo** |

---

## Modos de ejecución

- **bootstrap** — proyecto nuevo: crea toda la estructura desde cero
- **audit** — proyecto existente: integra sin romper lo que hay

Detectar modo antes de continuar:
```bash
# ¿Hay código de features existente?
ls src/features/ 2>/dev/null && echo "AUDIT" || echo "BOOTSTRAP"
```

---

## FASE 1 — TypeScript estricto

Actualizar `tsconfig.json` de **cada app** (modo bootstrap) o verificar que existan (modo audit):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Estas opciones convierten la ambigüedad en errores explícitos que el agente puede leer y corregir. El compilador es el mejor aliado — documentación que nunca envejece.

> **Modo audit**: correr `pnpm typecheck` primero. Si hay errores pre-existentes, documentarlos en CLAUDE.md y resolverlos antes de continuar.

---

## FASE 2 — Gate único de verificación (`pnpm verify`)

Agregar a `package.json` de cada app (o raíz en modo simple):

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "verify":    "pnpm typecheck && pnpm lint && pnpm test --run",
    "supabase:gen": "supabase gen types typescript --linked > src/types/database.types.ts",
    "supabase:gen:local": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

`verify` es el comando que el agente corre tras **cada** cambio antes de proponer un commit. Un comando, una señal, sin ambigüedad.

En Turborepo, agregar tarea al `turbo.json`:
```json
{
  "tasks": {
    "verify": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

---

## FASE 3 — Arquitectura por features

### 3.1 Estructura base

Crear en cada app transaccional (`apps/app/src/` o `src/` en modo simple):

```
src/
├── features/
│   └── <dominio>/              # una carpeta por dominio de negocio
│       ├── <dominio>.schema.ts  # Zod schemas + z.infer types
│       ├── <dominio>.queries.ts # lecturas Supabase (sin mutaciones)
│       ├── <dominio>.actions.ts # Server Actions + mutaciones
│       ├── <dominio>.controller.ts # handler para route.ts (thin)
│       ├── <dominio>.test.ts    # tests co-localizados
│       └── index.ts             # barrel: API pública del módulo
├── types/
│   └── database.types.ts       # generado por supabase:gen — nunca editar a mano
└── lib/
    └── supabase/
        └── server.ts
```

Regla de naming: **`<feature>.<rol>.ts`** — siempre, sin excepciones.
El patrón uniforme es lo que el agente aprende una vez y replica sin error.

### 3.2 Route handlers delgados (App Router)

El App Router solo enruta archivos bajo `app/`. La lógica vive en `features/`.

```typescript
// app/api/<dominio>/route.ts — delgado, solo enruta
export { POST, GET } from '@/features/<dominio>/<dominio>.controller';
```

```typescript
// features/<dominio>/<dominio>.controller.ts — lógica real
import { type NextRequest, NextResponse } from 'next/server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { <Dominio>Schema } from './index';

export async function POST(req: NextRequest) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '<dominio>:crear');
  try {
    const body = await req.json();
    const result = <Dominio>Schema.safeParse(body);
    if (!result.success) {
      log.warn('validación fallida', { errores: result.error.flatten() });
      return NextResponse.json({ error: 'ERR_VALIDACION' }, { status: 400 });
    }
    // lógica de negocio...
    log.info('completado');
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error(err, { codigo: 'ERR_NEGOCIO_GENERICO' });
    return NextResponse.json({ error: 'ERR_INTERNO' }, { status: 500 });
  }
}
```

### 3.3 Barrel con API pública explícita

`features/<dominio>/index.ts`:
```typescript
// API pública del módulo <dominio>
// Solo lo que está aquí es importable desde fuera de este módulo.

export { <Dominio>Schema, type <Dominio> }  from './<dominio>.schema';
export { get<Dominio>s, get<Dominio>ById }  from './<dominio>.queries';
export { crear<Dominio>, actualizar<Dominio>, eliminar<Dominio> } from './<dominio>.actions';
// No exportar: controller, test helpers, implementaciones internas
```

### 3.4 Zod: fuente única de verdad

`features/<dominio>/<dominio>.schema.ts`:
```typescript
import { z } from 'zod';

// Una sola fuente: el tipo SE DERIVA del schema, nunca al revés
export const <Dominio>Schema = z.object({
  id:         z.string().uuid().optional(),
  nombre:     z.string().min(1).max(255),
  orgId:      z.string().uuid(),
  creadoEn:   z.string().datetime().optional(),
});

export type <Dominio> = z.infer<typeof <Dominio>Schema>;

// Schema para creación (sin id ni creadoEn)
export const Crear<Dominio>Schema = <Dominio>Schema.omit({ id: true, creadoEn: true });
export type Crear<Dominio>Input = z.infer<typeof Crear<Dominio>Schema>;
```

En Server Actions, usar siempre `safeParse` + código de error:
```typescript
// features/<dominio>/<dominio>.actions.ts
'use server';
import { Crear<Dominio>Schema } from './index';
import { agenticLogger, crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';
import { createClient } from '@/lib/supabase/server';

export async function crear<Dominio>(formData: FormData) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '<dominio>:crear');

  const result = Crear<Dominio>Schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    log.warn('validación fallida', { errores: result.error.flatten() });
    return { error: 'ERR_VALIDACION', detalles: result.error.flatten() };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('<dominio>s')
      .insert(result.data)
      .select()
      .single();

    if (error) throw error;
    log.info('creado', { id: data.id });
    return { data };
  } catch (err) {
    log.error(err, { codigo: mapearCodigoPostgres((err as { code?: string }).code) });
    return { error: 'ERR_INTERNO' };
  }
}
```

---

## FASE 4 — ESLint: fronteras de módulo

Agregar a la config de ESLint del proyecto:

```javascript
// eslint.config.js o .eslintrc.cjs
module.exports = {
  rules: {
    // No deep imports entre features — solo por barrel (index.ts)
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['*/features/*/!(index)'],
          message: 'Importar desde el barrel del módulo: "@/features/<dominio>" no desde archivos internos.',
        },
      ],
    }],

    // Logging (del agentic-logging standard)
    'no-console': ['warn', { allow: [] }],
    'no-empty':   ['error', { allowEmptyCatch: false }],

    // Calidad de código
    'prefer-const':     'error',
    'no-var':           'error',
    '@typescript-eslint/no-explicit-any':     'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
};
```

---

## FASE 5 — Generador de features

Crear `scripts/new-feature.mjs` — crea el scaffold de una feature nueva en un comando:

```javascript
#!/usr/bin/env node
// scripts/new-feature.mjs
// Uso: node scripts/new-feature.mjs <dominio>
// Ejemplo: node scripts/new-feature.mjs inventario

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const [,, dominio] = process.argv;
if (!dominio) {
  console.error('Uso: node scripts/new-feature.mjs <dominio>');
  process.exit(1);
}

// Capitalizar para nombres de tipo
const Dominio = dominio.charAt(0).toUpperCase() + dominio.slice(1);

// Detectar src dir (monorepo vs simple)
const srcBase = existsSync('apps/app/src') ? 'apps/app/src' : 'src';
const dir = join(srcBase, 'features', dominio);

if (existsSync(dir)) {
  console.error(`❌ La feature "${dominio}" ya existe en ${dir}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

const files = {
  [`${dominio}.schema.ts`]: `import { z } from 'zod';

export const ${Dominio}Schema = z.object({
  id:       z.string().uuid().optional(),
  nombre:   z.string().min(1).max(255),
  orgId:    z.string().uuid(),
});

export type ${Dominio} = z.infer<typeof ${Dominio}Schema>;
export const Crear${Dominio}Schema = ${Dominio}Schema.omit({ id: true });
export type Crear${Dominio}Input = z.infer<typeof Crear${Dominio}Schema>;
`,

  [`${dominio}.queries.ts`]: `import { createClient } from '@/lib/supabase/server';
import type { ${Dominio} } from './index';

export async function get${Dominio}s(orgId: string): Promise<${Dominio}[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('${dominio}s')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}
`,

  [`${dominio}.actions.ts`]: `'use server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';
import { createClient } from '@/lib/supabase/server';
import { Crear${Dominio}Schema } from './index';

export async function crear${Dominio}(formData: FormData) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '${dominio}:crear');
  const result = Crear${Dominio}Schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    log.warn('validación fallida', { errores: result.error.flatten() });
    return { error: 'ERR_VALIDACION', detalles: result.error.flatten() };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('${dominio}s').insert(result.data).select().single();
    if (error) throw error;
    log.info('creado', { id: data.id });
    return { data };
  } catch (err) {
    log.error(err, { codigo: mapearCodigoPostgres((err as { code?: string }).code) });
    return { error: 'ERR_INTERNO' };
  }
}
`,

  [`${dominio}.controller.ts`]: `import { type NextRequest, NextResponse } from 'next/server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { Crear${Dominio}Schema } from './index';

export async function POST(req: NextRequest) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '${dominio}:crear');
  try {
    const body = await req.json();
    const result = Crear${Dominio}Schema.safeParse(body);
    if (!result.success) {
      log.warn('validación fallida', { errores: result.error.flatten() });
      return NextResponse.json({ error: 'ERR_VALIDACION' }, { status: 400 });
    }
    // TODO: implementar lógica
    log.info('completado');
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    log.error(err, { codigo: 'ERR_NEGOCIO_GENERICO' });
    return NextResponse.json({ error: 'ERR_INTERNO' }, { status: 500 });
  }
}
`,

  [`${dominio}.test.ts`]: `import { describe, it, expect, vi } from 'vitest';
import { Crear${Dominio}Schema } from './${dominio}.schema';

describe('${Dominio} schema', () => {
  it('valida input correcto', () => {
    const result = Crear${Dominio}Schema.safeParse({
      nombre: 'Test ${Dominio}',
      orgId:  '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = Crear${Dominio}Schema.safeParse({ nombre: '', orgId: 'uuid' });
    expect(result.success).toBe(false);
  });
});
`,

  [`index.ts`]: `// API pública de la feature ${dominio}
// Solo lo que está aquí es importable desde fuera de este módulo.
// No hacer deep imports: importar desde '@/features/${dominio}', no desde archivos internos.

export { ${Dominio}Schema, Crear${Dominio}Schema } from './${dominio}.schema';
export type { ${Dominio}, Crear${Dominio}Input }   from './${dominio}.schema';
export { get${Dominio}s }                          from './${dominio}.queries';
export { crear${Dominio} }                         from './${dominio}.actions';
`,
};

for (const [filename, content] of Object.entries(files)) {
  writeFileSync(join(dir, filename), content, 'utf8');
  console.log(`  ✓ ${dir}/${filename}`);
}

// Generar migration stub
const now = new Date();
const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
const migrationDir = 'supabase/migrations';
const migrationFile = `${ts}_add_${dominio}.sql`;
const migrationContent = `-- Migration: add_${dominio}
-- Generada por: pnpm new-feature ${dominio}

CREATE TABLE IF NOT EXISTS public.${dominio}s (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON public.${dominio}s(org_id);

-- RLS (OBLIGATORIO — deny by default)
ALTER TABLE public.${dominio}s ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: miembros de la org pueden leer
CREATE POLICY "${dominio}s_select" ON public.${dominio}s
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT auth.user_orgs()));

-- Policy INSERT: miembros admin+ pueden crear
CREATE POLICY "${dominio}s_insert" ON public.${dominio}s
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT auth.user_orgs()));

-- Policy UPDATE/DELETE: owner/admin solo
-- (añadir cuando se necesite)
`;

if (existsSync(migrationDir)) {
  writeFileSync(`${migrationDir}/${migrationFile}`, migrationContent, 'utf8');
  console.log(`  ✓ ${migrationDir}/${migrationFile}`);
} else {
  console.log(`  ⚠️  supabase/migrations/ no existe — crear migración manualmente`);
}

console.log(`\n✅ Feature "${dominio}" creada en ${dir}/`);
console.log(`\n📋 RUNBOOK — pasos siguientes en orden:`);
console.log(`\n  1. Editar la migración SQL:`);
console.log(`     ${migrationDir}/${migrationFile}`);
console.log(`     → ajustar columnas, agregar más policies RLS si necesario`);
console.log(`\n  2. Aplicar migración local:`);
console.log(`     supabase db reset        # resetea + aplica todo + seed`);
console.log(`     # o solo la nueva:`);
console.log(`     supabase db push --local`);
console.log(`\n  3. Regenerar tipos TypeScript:`);
console.log(`     pnpm supabase:gen:local`);
console.log(`\n  4. Implementar lógica en:`);
console.log(`     ${dir}/${dominio}.queries.ts  ← lecturas`);
console.log(`     ${dir}/${dominio}.actions.ts  ← mutaciones (Server Actions)`);
console.log(`     ${dir}/${dominio}.controller.ts ← route handler`);
console.log(`\n  5. Crear route delgado:`);
console.log(`     app/api/${dominio}/route.ts`);
console.log(`     → export { POST, GET } from '@/features/${dominio}/${dominio}.controller';`);
console.log(`\n  6. pnpm verify  (debe pasar en verde)`);
console.log(`\n  ⚠️  Si la tabla devuelve 0 filas: verificar RLS policies y memberships del usuario`);
console.log(`\n  📖 Guía completa: ver sección "Flujo de nueva feature" en CLAUDE.md\n`);
```

Agregar a `package.json`:
```json
{
  "scripts": {
    "new-feature": "node scripts/new-feature.mjs"
  }
}
```

**Uso**:
```bash
pnpm new-feature inventario
# → crea src/features/inventario/ con los 6 archivos base
```

---

## FASE 6 — Vitest (testing co-localizado)

Instalar Vitest en modo bootstrap:
```bash
pnpm add -D vitest @vitejs/plugin-react
```

`vitest.config.ts` en cada app:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include:     ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage:    { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

Actualizar `package.json`:
```json
{
  "scripts": {
    "test":    "vitest run",
    "test:ui": "vitest --ui",
    "test:watch": "vitest",
    "verify":  "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

---

## FASE 6.5 — Seed local y debugging RLS

### supabase/seed.sql

Crear `supabase/seed.sql` con datos mínimos para que el desarrollo local funcione tras `supabase db reset`:

```sql
-- supabase/seed.sql
-- Se ejecuta automáticamente con: supabase db reset

-- Organización de prueba (solo si USE_MULTITENANCY=true)
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Org Demo', 'org-demo')
ON CONFLICT (id) DO NOTHING;

-- Nota: usuarios de auth se crean via Supabase Dashboard > Auth > Users (en local: localhost:54323)
-- o via el script: pnpm supabase:seed-users (crear si necesario)
```

### Debugging RLS silencioso

RLS puede devolver 0 filas SIN lanzar error — el agente recibe datos vacíos sin traceId.

**Patrón de detección en código**:
```typescript
// En queries, loggear explícitamente cuando el resultado es vacío inesperadamente
const { data, error, count } = await supabase
  .from('items').select('*', { count: 'exact' }).eq('org_id', orgId);

if (error) throw error; // esto sí genera traceId via agenticLogger

if (count === 0) {
  log.warn('resultado vacío — posible bloqueo RLS', { tabla: 'items', orgId });
}
```

**Debugging en Supabase Studio**:
```sql
-- Simular la query como un usuario específico
SELECT set_config('request.jwt.claims', '{"sub":"USER_UUID","role":"authenticated"}', true);
SELECT * FROM items WHERE org_id = 'ORG_UUID';

-- Verificar policies existentes
SELECT * FROM pg_policies WHERE tablename = 'items';

-- Verificar membership del usuario
SELECT * FROM memberships WHERE user_id = 'USER_UUID';
```

---

## FASE 6.6 — Edge vs Node Runtime (documentar en proyecto)

Next.js tiene dos runtimes. La confusión entre ellos causa crashes silenciosos en Edge.

**Regla simple**: usa Node runtime (el default) salvo que necesites latencia ultra-baja en el edge.

Agregar a `apps/app/src/middleware.ts` el comentario:
```typescript
// EDGE RUNTIME — restricciones:
// - Sin createAdminClient() (service_role key no debe estar en edge)
// - Sin agenticLogger completo (usa APIs de Node)
// - Sin imports de node:* (fs, crypto completo, etc.)
// - Para lógica compleja: usar un Route Handler y Next.redirect()
```

Si se necesita un Route Handler en Edge explícitamente (raro):
```typescript
// app/api/alguna-ruta/route.ts
export const runtime = 'edge'; // solo si sabes lo que haces

// ⚠️ En edge NO usar:
// import { createAdminClient } from '@/lib/supabase/server';
// import { agenticLogger } from '@/utils/logger';
```

---

## FASE 7 — CLAUDE.md slim (operativo por proyecto)

Generar `CLAUDE.md` en la raíz del proyecto con este contenido base.
El `generate-context.js` (FASE 8 de `alyp-new-project`) actualiza la sección de features automáticamente.

```markdown
<!-- agentic-standard: v1 -->
# CLAUDE.md — $CLIENT_NAME

> Versión corta y operativa para el agente. La guía completa vive en el skill `alyp-agentic-standards`.

## Stack
- Next.js (latest) · React 19 · TypeScript strict
- Supabase (Auth + Postgres + RLS) · @supabase/ssr
- Tailwind CSS v4 · shadcn/ui
- TanStack Query · react-hook-form · Zod

## Mapa de ambientes

| Rama | Supabase | Vercel scope | LOG_PROVIDER | Notas |
|------|----------|--------------|--------------|-------|
| `next dev` local | DEV | — | `local` | logs en `logs/dev.log` |
| `develop` branch | DEV | Preview (develop) | `http` | drain → backend dev |
| `staging` branch | STAGING | Preview (staging) | `http` | drain → backend staging |
| `main` | PROD | Production | `http` | drain → backend prod |

> ⚠️ Antes de correr migraciones: confirmar a qué Supabase está apuntando `DIRECT_URL`.
> `LOG_PROVIDER=local` solo funciona en `next dev`. En Vercel usa `http`.

## Comandos esenciales
| Comando | Qué hace |
|---------|----------|
| `pnpm verify` | **Gate único**: typecheck + lint + test — correr tras cada cambio |
| `pnpm dev` | Dev server |
| `pnpm build` | Build de producción |
| `pnpm new-feature <dominio>` | Scaffold de feature nueva |
| `pnpm supabase:gen` | Regenerar tipos de DB desde Supabase linked |
| `pnpm agent:gps <traceId>` | Ubicar error exacto en el código |

## Arquitectura — Feature-based

```
src/features/<dominio>/
  <dominio>.schema.ts       # Zod + z.infer — fuente única de tipos
  <dominio>.queries.ts      # lecturas Supabase
  <dominio>.actions.ts      # Server Actions + mutaciones
  <dominio>.controller.ts   # handler para route.ts (thin)
  <dominio>.test.ts         # tests co-localizados
  index.ts                  # barrel: API pública — solo importar desde aquí

app/api/<dominio>/route.ts  # delgado: export { POST } from '@/features/<dominio>/<dominio>.controller'
```

## Convenciones no negociables
1. `<feature>.<rol>.ts` — naming siempre, sin excepciones
2. `z.infer<typeof Schema>` — nunca duplicar tipos
3. `safeParse` + código UPPER_SNAKE en server actions y controllers
4. Named exports siempre — no `export default`
5. Deep imports prohibidos — solo por barrel (`@/features/<dominio>`)
6. Archivos < 200 líneas — si crece, dividir responsabilidades
7. Todo `catch` loggea con `agenticLogger.error(ctx, err)` — nunca vacío
8. Sin `console.log/error` — usar `agenticLogger`

## Edge vs Node Runtime

| Dónde | Runtime | Restricciones |
|-------|---------|---------------|
| `middleware.ts` | **Edge** | Sin `createAdminClient()`, sin `agenticLogger` completo, sin APIs de Node |
| Route Handlers (`app/api/`) | **Node** (default) | Sin restricciones |
| Server Actions | **Node** (default) | Sin restricciones |
| `app/.../page.tsx` RSC | **Node** (default) | Sin restricciones |

```typescript
// ✅ OK en Route Handlers y Server Actions
import { createAdminClient } from '@/lib/supabase/server';
import { agenticLogger } from '@/utils/logger';

// ❌ NUNCA en middleware.ts
// import { createAdminClient } from '@/lib/supabase/server'; // edge crash
```

> Si necesitas lógica compleja en middleware: moverla a un Route Handler y redirigir.

## Definición de "done" (antes de cualquier commit)
- [ ] `pnpm verify` pasa — 0 errores TypeScript, 0 warnings ESLint críticos, tests verdes
- [ ] Sin `console.*` desnudos
- [ ] Sin `catch {}` vacíos
- [ ] Sin deep imports entre features
- [ ] Migración nueva si cambió el schema de DB
- [ ] `/api/health` responde `{ "status": "ok" }`

## Features del proyecto
<!-- AUTO-GENERADO por generate-context.js — no editar manualmente -->
| Feature | Dominio | Archivos |
|---------|---------|----------|
| (vacío — correr `node scripts/generate-context.js` para poblar) |

## Logging y debugging
Ante cualquier error con `traceId`:
```bash
pnpm agent:gps <traceId>
# Lee <<<AGENT_GPS_JSON>>> → archivo + línea → ir directo al fix
```

## Supabase
- RLS habilitado en TODAS las tablas — deny by default
- Tipos generados en `src/types/database.types.ts` — no editar a mano
- Migrations en `supabase/migrations/` — nunca SQL directo en producción
- Para errores Postgres: `mapearCodigoPostgres((err as any).code)` desde `utils/error-codes.ts`

## Flujo de nueva feature (runbook completo)

```bash
# 1. Generar scaffold
pnpm new-feature <dominio>

# 2. Crear migración (SIEMPRE si hay nueva tabla o cambio de schema)
supabase migration new add_<dominio>
# → editar el .sql generado en supabase/migrations/

# 3. Agregar RLS a la tabla (OBLIGATORIO — deny by default)
# En el mismo .sql:
# ALTER TABLE public.<dominio>s ENABLE ROW LEVEL SECURITY;
# CREATE POLICY "..." ON public.<dominio>s FOR SELECT TO authenticated USING (...);

# 4. Aplicar migración en local
supabase db reset           # resetea + aplica todas las migraciones + seed
# O solo la nueva:
supabase db push --local

# 5. Regenerar tipos TypeScript
pnpm supabase:gen:local     # genera src/types/database.types.ts

# 6. Implementar queries/actions/controller usando los nuevos tipos

# 7. Crear route delgado
# app/api/<dominio>/route.ts:
# export { POST, GET } from '@/features/<dominio>/<dominio>.controller';

# 8. Verificar
pnpm verify                 # typecheck + lint + test — debe pasar en verde

# 9. Commit atómico (feature + migración juntos)
git add src/features/<dominio>/ supabase/migrations/ src/types/ app/api/<dominio>/
git commit -m "feat(<dominio>): implementar módulo <dominio>"
```

> ⚠️ Sin política RLS, la tabla devolverá 0 filas a usuarios autenticados (RLS silencioso).
> Si `count === 0` inesperadamente: verificar `pg_policies` y `memberships` del usuario.

## Edge vs Node Runtime

| Dónde | Runtime | Restricciones |
|-------|---------|---------------|
| `middleware.ts` | **Edge** | Sin `createAdminClient()`, sin `agenticLogger` completo, sin APIs de Node |
| Route Handlers (`app/api/`) | **Node** (default) | Sin restricciones |
| Server Actions | **Node** (default) | Sin restricciones |
| `app/.../page.tsx` RSC | **Node** (default) | Sin restricciones |

```typescript
// ✅ OK en Route Handlers y Server Actions
import { createAdminClient } from '@/lib/supabase/server';
import { agenticLogger } from '@/utils/logger';

// ❌ NUNCA en middleware.ts
// import { createAdminClient } from '@/lib/supabase/server'; // edge crash
```

> Si necesitas lógica compleja en middleware: moverla a un Route Handler y redirigir.
```

---

## FASE 8 — CI: integrar verify como gate

Actualizar `.github/workflows/ci.yml` para que corra `verify` en vez de `build + lint + typecheck` por separado:

**Turborepo**:
```yaml
- name: Verify
  run: pnpm turbo run verify

- name: Test
  run: pnpm turbo run test
```

**Simple**:
```yaml
- name: Verify
  run: pnpm verify
```

---

## FASE 9 — Sello de versión del estándar

Verificar que el `CLAUDE.md` generado tiene el sello:
```bash
grep "agentic-standard: v1" CLAUDE.md || echo "⚠️ Falta sello de versión en CLAUDE.md"
```

El sello permite auditar qué versión del estándar sigue cada repo:
```bash
# En el futuro, para actualizar todos los repos a v2:
# → correr alyp-agentic-standards en modo audit sobre cada repo
```

---

## Verificación de la instalación (acceptance criteria)

```bash
# 1. verify pasa limpio
pnpm verify
# → 0 errores TypeScript, 0 warnings críticos ESLint, tests verdes

# 2. Generador funciona
pnpm new-feature test-dominio
# → crea src/features/test-dominio/ con 6 archivos

# 3. Deep import es bloqueado por ESLint
# Crear import interno y correr lint:
# import { algo } from '@/features/test-dominio/test-dominio.schema' → debe dar error ESLint
# import { algo } from '@/features/test-dominio' → debe pasar

# 4. supabase:gen genera tipos
pnpm supabase:gen
# → src/types/database.types.ts actualizado

# 5. CLAUDE.md slim tiene sello
grep "agentic-standard: v1" CLAUDE.md
```

---

## Modo audit — integrar en proyecto existente

1. Correr `pnpm typecheck` — documentar errores pre-existentes, no bloquear
2. Agregar `verify` script sin romper scripts existentes
3. Revisar `src/` — si hay lógica en `app/` o raíz, migrar a `src/features/` incrementalmente (feature por feature, no big bang)
4. Agregar barrel `index.ts` a cada carpeta de dominio que ya exista
5. Agregar ESLint `no-restricted-imports` — puede generar warnings; corregir en siguiente PR
6. Instalar Vitest si no hay test runner; no reemplazar si ya existe Jest
7. Regenerar `CLAUDE.md` slim (preservar secciones manuales del CLAUDE.md previo)
8. Stampar sello `<!-- agentic-standard: v1 -->`

---

## Checklist de instalación

**Bootstrap (proyecto nuevo):**
- [ ] `tsconfig.json` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [ ] `pnpm verify` script creado y pasa limpio
- [ ] `pnpm supabase:gen` y `pnpm supabase:gen:local` en scripts
- [ ] `src/features/` creado (vacío — se puebla con `pnpm new-feature`)
- [ ] `src/types/database.types.ts` placeholder creado
- [ ] `scripts/new-feature.mjs` creado y ejecutable
- [ ] `pnpm new-feature` en scripts de package.json
- [ ] Vitest instalado y `vitest.config.ts` creado
- [ ] ESLint: `no-restricted-imports` + `no-console` + `no-empty`
- [ ] CI: `pnpm verify` como gate en lugar de pasos separados
- [ ] `CLAUDE.md` slim generado con sello `agentic-standard: v1`
- [ ] Sello verificable con `grep "agentic-standard" CLAUDE.md`
- [ ] `new-feature.mjs` genera migration stub con RLS template e imprime runbook
- [ ] `supabase/seed.sql` creado con datos mínimos de prueba
- [ ] Mapa de ambientes en CLAUDE.md slim (rama→Supabase→LOG_PROVIDER)
- [ ] Runbook de nueva feature en CLAUDE.md slim (8 pasos ordenados)
- [ ] Edge vs Node runtime documentado en CLAUDE.md slim y middleware.ts
- [ ] Patrón de RLS silencioso en CLAUDE.md slim (warning + debugging SQL)

**Audit (proyecto existente) — adicional:**
- [ ] Errores TypeScript pre-existentes documentados en CLAUDE.md
- [ ] Migración incremental a `src/features/` planificada
- [ ] Barrels `index.ts` agregados a dominios existentes
- [ ] CLAUDE.md previo preservado en secciones manuales

---

## Referencia completa del estándar

La guía completa vive aquí como referencia consultable. No se copia a cada repo — el CLAUDE.md slim es lo único que el agente lee en cada sesión.

### Principio rector: el bucle del agente

Un agente siempre repite: LEER → ENTENDER → CAMBIAR → VERIFICAR.
Todo lo que abarata un paso sube la tasa de éxito y baja el consumo de tokens.

### Arquitectura por features — reglas

- Co-localización: todo lo de un dominio en `src/features/<dominio>/`
- Naming: `<feature>.<rol>.ts` — nunca romper el patrón
- Route handlers delgados: `app/api/.../route.ts` delega a `features/.../controller.ts`
- Barrel `index.ts`: declara la API pública; prohíbe deep imports via ESLint
- Archivos pequeños (< 200 líneas), una responsabilidad por archivo
- Named exports siempre — son greppables, el agente los localiza por nombre

### TypeScript como documentación viva

- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- El compilador convierte la ambigüedad en errores explícitos y reparables
- JSDoc solo donde el tipo no sea suficiente (reglas de negocio ocultas, efectos secundarios)

### Contratos Zod: una sola fuente de verdad

- Schema en `.schema.ts`, tipo derivado con `z.infer`
- `safeParse` + código UPPER_SNAKE en toda frontera pública
- Env tipado con `@t3-oss/env-nextjs` — falla rápido y claro si falta config
- Tipos de Supabase autogenerados — nunca escribir tipos de DB a mano

### VERIFICAR: la palanca más importante

- `pnpm verify` = typecheck + lint + test — un comando, una señal
- CI espejo del local — el agente recibe la misma señal local y remota
- Tests co-localizados con factories/fixtures — el agente escribe tests sin fricción

### Bootstrap determinista

- `git clone && pnpm install && pnpm dev` debe funcionar de cero
- `.env.example` completo con todos los placeholders
- `pnpm supabase:gen` regenera tipos en cualquier momento
