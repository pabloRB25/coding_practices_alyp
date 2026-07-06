---
name: alyp-agentic-standards
version: 1.1.0
provides: [code-standard]
requires: [agentic-logging]
description: >
  Estándar de código "agentic-ready" de Alyp Studio (sello: agentic-standard: v1).
  Usar cuando el usuario pida aplicar el estándar agentic-ready, crear una feature
  nueva en un proyecto Alyp, auditar la estructura de un proyecto existente,
  generar scaffolding de feature/dominio (schema Zod, queries, actions, controller,
  barrel), configurar el gate "pnpm verify", o mencione "agentic-standard: v1".
  Optimiza el ciclo del agente LEER → ENTENDER → CAMBIAR → VERIFICAR con
  co-localización por feature, contratos Zod y verificación determinista.
---

# Alyp Studio — Agentic-Ready Standards

Aplica el estándar de código "agentic-ready" en proyectos Alyp Studio.
Optimiza el ciclo del agente: **LEER → ENTENDER → CAMBIAR → VERIFICAR**.

**Versión del estándar**: `agentic-standard: v1`
**Principio**: lo que abarata cada paso del ciclo sube la tasa de éxito y baja el consumo de tokens.

| Paso | Qué lo abarata |
|------|----------------|
| Leer | Co-localización por feature, nombres predecibles, archivos pequeños |
| Entender | Tipos estrictos, contratos Zod, env tipado, compilador como documentación |
| Cambiar | Generador de features, barrels, límites de módulo, commits atómicos |
| **Verificar** | **`pnpm verify` determinista + CI espejo** |

> **Plantillas**: los bloques de código viven en `assets/templates/` — copiá cada archivo reemplazando `<Dominio>`/`<dominio>` por el nombre real del dominio (excepto `new-feature.mjs`, que se copia tal cual: usa `${dominio}` en runtime).
> **Justificación del estándar**: ver `references/rationale.md` (no necesaria para ejecutar).

## Modos de ejecución

- **bootstrap** — proyecto nuevo: crea toda la estructura desde cero
- **audit** — proyecto existente: integra sin romper lo que hay

Detectar modo antes de continuar:
```bash
# ¿Hay código de features existente?
ls src/features/ 2>/dev/null && echo "AUDIT" || echo "BOOTSTRAP"
```

## FASE 1 — TypeScript estricto

Actualizar `tsconfig.json` de **cada app** (modo bootstrap) o verificar que existan las opciones (modo audit): mergear `compilerOptions` de `assets/templates/tsconfig.strict.json`.

Estas opciones convierten la ambigüedad en errores explícitos que el agente puede leer y corregir.

> **Modo audit**: correr `pnpm typecheck` primero. Si hay errores pre-existentes, documentarlos en CLAUDE.md y resolverlos antes de continuar.

## FASE 2 — Gate único de verificación (`pnpm verify`)

Agregar a `package.json` de cada app (o raíz en modo simple) los scripts de `assets/templates/package.scripts.verify.json`.

`verify` es el comando que el agente corre tras **cada** cambio antes de proponer un commit. Un comando, una señal, sin ambigüedad.

En Turborepo, agregar al `turbo.json` las tareas de `assets/templates/turbo.verify.json`.

### Definición de "done" (verify + evidencia)

`pnpm verify` es el gate **determinista** (tsc + lint + tests) y es condición **necesaria, no suficiente**. Una tarea está "done" cuando se cumplen las dos:

1. `pnpm verify` pasa limpio, y
2. existe **evidencia reproducible del happy path**: para lógica, un test co-localizado que la cubre; para runtime de client (server actions, hidratación, RLS silencioso), evidencia de browser (chrome-devtools: status 200 + consola limpia + screenshot) o el `log.warn` de resultado vacío disparándose donde corresponde.

"Parece correcto" sin alguna de las dos no es done — es **no-evaluable**. Es la misma regla que aplica el agente `revisor`/juez: sin evidencia recolectable y determinista, el veredicto no es positivo.

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

### 3.2–3.4 Plantillas por archivo

| Archivo destino | Template (copiá reemplazando `<Dominio>`/`<dominio>`) |
|-----------------|-------------------------------------------------------|
| `app/api/<dominio>/route.ts` | `assets/templates/route.ts` — delgado, solo re-exporta del controller |
| `features/<dominio>/<dominio>.controller.ts` | `assets/templates/dominio.controller.ts` — lógica real |
| `features/<dominio>/index.ts` | `assets/templates/index.ts` — barrel: API pública explícita |
| `features/<dominio>/<dominio>.schema.ts` | `assets/templates/dominio.schema.ts` — Zod fuente única de verdad |
| `features/<dominio>/<dominio>.actions.ts` | `assets/templates/dominio.actions.ts` — Server Actions con `safeParse` |
| `features/<dominio>/<dominio>.queries.ts` | `assets/templates/dominio.queries.ts` — lecturas Supabase |
| `features/<dominio>/<dominio>.test.ts` | `assets/templates/dominio.test.ts` — tests co-localizados |

Reglas de la fase:
- El App Router solo enruta archivos bajo `app/`. La lógica vive en `features/`.
- Barrel: solo lo exportado en `index.ts` es importable desde fuera. No exportar controller, test helpers ni implementaciones internas.
- Zod: el tipo SE DERIVA del schema con `z.infer`, nunca al revés.
- En Server Actions, usar siempre `safeParse` + código de error UPPER_SNAKE.

## FASE 4 — ESLint: fronteras de módulo

Agregar a la config de ESLint del proyecto las reglas de `assets/templates/eslint.module-boundaries.cjs`: no deep imports entre features (solo por barrel), `no-console`, `no-empty` sin catch vacío, calidad de código.

## FASE 5 — Generador de features

Copiar `assets/templates/new-feature.mjs` a `scripts/new-feature.mjs` **tal cual, sin reemplazos** — crea el scaffold de una feature nueva en un comando, más un stub de migración SQL con RLS (referencia del stub: `assets/templates/migration_add_dominio.sql`) e imprime el runbook.

Agregar a `package.json` el script de `assets/templates/package.scripts.new-feature.json`.

**Uso**:
```bash
pnpm new-feature inventario
# → crea src/features/inventario/ con los 6 archivos base
```

## FASE 6 — Vitest (testing co-localizado)

Instalar Vitest en modo bootstrap:
```bash
pnpm add -D vitest @vitejs/plugin-react
```

Copiar `assets/templates/vitest.config.ts` a cada app y actualizar `package.json` con los scripts de `assets/templates/package.scripts.test.json`.

## FASE 6.5 — Seed local y debugging RLS

Crear `supabase/seed.sql` copiando `assets/templates/seed.sql` (datos mínimos para que el desarrollo local funcione tras `supabase db reset`).

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

**Debugging en Supabase Studio**: usar las queries de `assets/templates/rls-debugging.sql` (simular usuario, verificar policies y memberships).

## FASE 6.6 — Edge vs Node Runtime (documentar en proyecto)

Next.js tiene dos runtimes. La confusión entre ellos causa crashes silenciosos en Edge.

**Regla simple**: usa Node runtime (el default) salvo que necesites latencia ultra-baja en el edge.

- Agregar a `apps/app/src/middleware.ts` el comentario de `assets/templates/middleware.edge-comment.ts`.
- Si se necesita un Route Handler en Edge explícitamente (raro): ver `assets/templates/route.edge.ts`.

## FASE 7 — CLAUDE.md slim (operativo por proyecto)

Generar `CLAUDE.md` en la raíz del proyecto copiando `assets/templates/CLAUDE.slim.md` (reemplazar `$CLIENT_NAME`). Incluye: mapa de ambientes, comandos esenciales, arquitectura, convenciones, definición de "done", runbook de nueva feature y Edge vs Node.
El `generate-context.js` (FASE 8 de `alyp-new-project`) actualiza la sección de features automáticamente.

Convenciones no negociables (también en el CLAUDE.md slim):
1. `<feature>.<rol>.ts` — naming siempre, sin excepciones
2. `z.infer<typeof Schema>` — nunca duplicar tipos
3. `safeParse` + código UPPER_SNAKE en server actions y controllers
4. Named exports siempre — no `export default`
5. Deep imports prohibidos — solo por barrel (`@/features/<dominio>`)
6. Archivos < 200 líneas — si crece, dividir responsabilidades
7. Todo `catch` loggea con `agenticLogger.error(ctx, err)` — nunca vacío
8. Sin `console.log/error` — usar `agenticLogger`
9. "Done" = `pnpm verify` verde **+** evidencia reproducible del happy path — nunca "parece correcto" (ver Definición de "done" en FASE 2 y el agente `revisor`/juez)

Commit atómico: feature + migración juntos (`git add src/features/<dominio>/ supabase/migrations/ src/types/ app/api/<dominio>/`).

## FASE 8 — CI: integrar verify como gate

Actualizar `.github/workflows/ci.yml` para que corra `verify` en vez de `build + lint + typecheck` por separado:
- **Turborepo**: pasos de `assets/templates/ci-verify-turbo.yml`
- **Simple**: paso de `assets/templates/ci-verify-simple.yml`

## FASE 9 — Sello de versión del estándar

Verificar que el `CLAUDE.md` generado tiene el sello:
```bash
grep "agentic-standard: v1" CLAUDE.md || echo "⚠️ Falta sello de versión en CLAUDE.md"
```

El sello permite auditar qué versión del estándar sigue cada repo (para actualizar a v2 en el futuro: correr este skill en modo audit sobre cada repo).

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

## Modo audit — integrar en proyecto existente

1. Correr `pnpm typecheck` — documentar errores pre-existentes, no bloquear
2. Agregar `verify` script sin romper scripts existentes
3. Revisar `src/` — si hay lógica en `app/` o raíz, migrar a `src/features/` incrementalmente (feature por feature, no big bang)
4. Agregar barrel `index.ts` a cada carpeta de dominio que ya exista
5. Agregar ESLint `no-restricted-imports` — puede generar warnings; corregir en siguiente PR
6. Instalar Vitest si no hay test runner; no reemplazar si ya existe Jest
7. Regenerar `CLAUDE.md` slim (preservar secciones manuales del CLAUDE.md previo)
8. Stampar sello `<!-- agentic-standard: v1 -->`

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
