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
9. "Done" = `pnpm verify` verde **+** evidencia reproducible del happy path — nunca "parece correcto"
10. Código muerto se **elimina en el mismo PR** que lo deja huérfano — nunca comentado ni en `/old`; git es el archivo

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
- [ ] Sin código huérfano dejado por el cambio — si algo quedó sin referencias, se eliminó en este mismo PR
- [ ] Migración nueva si cambió el schema de DB
- [ ] `/api/health` responde `{ "status": "ok" }`

## Features del proyecto
<!-- FEATURE-INDEX:START -->
_Correr `pnpm feature-index` para poblar. Este bloque es generado — no editarlo a mano (I10)._
<!-- FEATURE-INDEX:END -->

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
