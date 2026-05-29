# Guía: Cómo hacer un proyecto "Agentic-Ready" (de manera sencilla)

Objetivo: que un agente de código (Claude Code, Antigravity, etc.) pueda **analizar, entender y generar código** en el proyecto de la forma más efectiva y eficiente posible — con la menor cantidad de contexto y la mayor tasa de acierto al primer intento.

---

## Principio rector: optimiza el bucle del agente

Un agente siempre repite el mismo ciclo:

> **LEER** el código relevante → **ENTENDER** los contratos → **CAMBIAR** lo necesario → **VERIFICAR** que no rompió nada.

Todo lo que abarata o desambigua *cada paso* sube su tasa de éxito y baja el consumo de tokens. La conclusión práctica: **no se trata solo de arquitectura, se trata de hacer baratos los cuatro pasos.** El blueprint cubre bien LEER y ENTENDER; la mayor palanca que falta es VERIFICAR.

| Paso | Qué lo abarata |
|---|---|
| Leer | Co-localización por feature, nombres predecibles, archivos pequeños |
| Entender | Tipos estrictos, contratos Zod, env tipado, el compilador como documentación |
| Cambiar | Plantillas/generadores, límites de módulo, commits pequeños |
| **Verificar** | **Un solo comando determinista (`verify`) + tests como gates + CI espejo** |

---

## Parte 1 — Análisis del blueprint propuesto

### 1. Arquitectura por features (co-localización) — correcto, con 3 ajustes

La idea es acertada: agrupar por dominio de negocio reduce el espacio de lectura del agente a un solo directorio. Mantenerlo. Ajustes:

**A. Conflicto con el Next.js App Router (importante).** El árbol propuesto pone `api-route.ts` dentro de `features/inventario/`, pero el App Router **solo enruta archivos `route.ts` que vivan bajo `app/`**. Un handler en `features/` no se expone como endpoint. Patrón correcto: el `app/.../route.ts` es delgado (parseo + llamada) y **delega** en la lógica de la feature:

```ts
// app/api/inventario/route.ts  (thin — solo enruta)
export { POST } from '@/features/inventario/inventario.controller';
```

Así conservas la co-localización real de la lógica y respetas el enrutamiento del framework.

**B. Nombrado inconsistente.** El esquema es `<feature>.<rol>.ts` (`inventario.actions.ts`, `inventario.schema.ts`...), pero `api-route.ts` rompe el patrón. Unifica a `inventario.controller.ts` / `inventario.route.ts`. La **consistencia importa más que el nombre elegido**: un patrón uniforme es algo que el agente aprende una vez y aplica siempre.

**C. Falta la frontera del módulo.** Añade por feature: un `index.ts` (barrel) que declare la **API pública** del módulo, y prohíbe los *deep imports* entre features con ESLint (`no-restricted-imports`). Sin esto, el agente acaba creando dependencias cruzadas que ensucian el grafo. Opcional pero barato: una línea de descripción del dominio al inicio del barrel.

### 2. Contratos de datos y tipado E2E — fuerte, con mejoras

Tipos autogenerados de Supabase + Zod en la frontera es exactamente lo correcto: convierte los contratos en algo legible por máquina y hace que los fallos sean explícitos y localizados. Mejoras:

**A. Una sola fuente de verdad.** No dupliques tipos e validaciones; deriva el tipo del esquema con `z.infer`:

```ts
export const OrdenSchema = z.object({ clienteId: z.string().uuid(), sku: z.string().min(3), cantidad: z.number().int().positive() });
export type Orden = z.infer<typeof OrdenSchema>; // el tipo y la validación nunca se desincronizan
```

**B. Valida más que el input.** El mismo rigor aplica a (1) las **variables de entorno** al arranque (env tipado con Zod → falla rápido y claro si falta config, algo que un agente no puede adivinar) y (2) las **respuestas de APIs externas** antes de confiar en ellas.

**C. `safeParse` + mapeo a código.** En lugar de dejar que el `ZodError` burbujee como genérico, usa `safeParse` y mapea el fallo a un código estandarizado (`ERR_VALIDACION`) para el logger. Así el error de validación entra al mismo sistema "GPS".

**D. `supabase gen` según entorno.** `--local` requiere Supabase corriendo localmente; para CI/producción apunta al proyecto enlazado (`--linked` / `--project-id`). Documenta ambos en `package.json`.

### 3. Script `agent-gps` — usa la versión ya mejorada

El blueprint muestra la versión inicial del script, que tiene dos defectos ya corregidos en el kit de logging que generamos: importa `execSync` sin usarlo y **re-parsea el stack con regex en tiempo de lectura**. La versión del kit emite la ubicación ya estructurada (`archivo`/`linea`/`columna`/`funcion`) desde el logger, soporta múltiples proveedores (`local`/`axiom`/`http`) y normaliza rutas `file://`. **No dupliques: usa la del kit `agentic-logging`.**

### 4. Archivo de contexto `ai.md` — corrige el nombre (crítico)

La idea de un archivo de directrices que el agente lee cada sesión es correcta, pero **`ai.md` no se carga automáticamente**. Claude Code lee **`CLAUDE.md`**; `AGENTS.md` es la convención emergente multi-herramienta. Renómbralo a `CLAUDE.md` (y opcionalmente publica `AGENTS.md` para otros agentes). Si no, el agente ignora tus directrices.

Sobre el contenido, hazlo **corto e imperativo** (los agentes siguen mejor directrices concisas) e incluye lo que de verdad mueve la aguja:
- Los **comandos exactos**: `verify`, `test`, `lint`, `typecheck`, `supabase:gen`.
- Las convenciones (Zod en `.schema.ts`, nada de `catch` vacíos, usar el logger).
- La **definición de "done"**: qué debe pasar antes de proponer un commit.
- Un **mapa de features** (qué hay y dónde) para orientar la lectura.
- Para módulos grandes, un `CLAUDE.md` anidado dentro de la feature (Claude Code los lee).

### 5. Tabla resumen — buena base; la amplío en la Parte 3.

---

## Parte 2 — Mis recomendaciones adicionales (lo que falta)

Organizadas por el paso del bucle que mejoran.

### A. VERIFICAR — la palanca más importante (y la que falta en el blueprint)

El éxito de un agente depende sobre todo de poder **comprobar su propio trabajo barato y rápido**. Si el ciclo "edito → compruebo → leo el error → corrijo" es de un comando, el agente converge solo; si no, adivina.

- **Un solo comando de verificación:** `npm run verify` = `typecheck` + `lint` + `test`. Es el "gate" único que el agente corre tras cada cambio.
  ```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "verify": "npm run typecheck && npm run lint && npm run test"
  }
  ```
- **TypeScript en modo estricto.** El compilador es el mejor aliado del agente: convierte la ambigüedad en errores explícitos que él puede leer y arreglar. Activa `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Tests co-localizados como gates de aceptación** (ya en el blueprint). Añade **factories/fixtures** para que el agente escriba tests sin fricción.
- **CI espejo del local.** El pipeline corre exactamente los mismos gates → el agente recibe la misma señal local y remota, sin sorpresas.

### B. ENTENDER — tipos y compilador como documentación viva

- **Named exports** (no `default`): son *greppables*, el agente los localiza por nombre.
- **Archivos pequeños, una responsabilidad.** Menos contexto por archivo, menos daño colateral al editar. Evita los "god files".
- **JSDoc solo donde no sea obvio** (reglas de negocio, efectos secundarios). Documentación que envejece mal es peor que nada; los tipos no envejecen.

### C. LEER — minimiza el espacio de búsqueda

- Co-localización (ya) + **barrels** que marcan los puntos de entrada.
- **Predecibilidad sobre ingenio.** Estructura y nombres uniformes; un patrón aburrido y repetido es lo que un agente explota mejor.
- **Evita la magia.** Metaprogramación, imports dinámicos y DI implícita rompen el análisis estático. Código explícito = código analizable.

### D. CAMBIAR — consistencia garantizada y límites claros

- **Generador/scaffold de features** (p. ej. `plop`, o una plantilla documentada). Es la forma *más sencilla* de garantizar que toda feature se vea idéntica: el agente aprende el patrón una vez y lo replica. Esta es la respuesta directa al "de manera sencilla".
- **Límites de import por ESLint** (`no-restricted-imports` / `import/no-restricted-paths`): nada cruza entre features salvo por su barrel.
- **Env validado al arranque** (Parte 1, §2B): fallo claro y temprano en vez de errores silenciosos a mitad de ejecución.
- **Commits convencionales + PRs pequeños.** Cambios atómicos y legibles, historial parseable por el agente.

### E. ARRANCAR — bootstrap determinista

- `git clone && npm install && npm run dev` debe funcionar de cero. `.env.example` completo, datos de *seed*, todo idempotente. Un proyecto que no arranca de forma reproducible bloquea tanto al agente como al CI.

---

## Parte 3 — Tabla consolidada de estándares

| Dimensión | Práctica obligatoria | Paso del bucle | Impacto agentic |
|---|---|---|---|
| Verificación | `npm run verify` (typecheck+lint+test) en un comando; CI espejo | Verificar | Corrección al primer intento; el agente converge solo |
| Tipado | TS `strict` + `noUncheckedIndexedAccess`; el compilador como contrato | Entender | Ambigüedad → error explícito y reparable |
| Contratos | Zod en la frontera + `z.infer` (fuente única) + env tipado | Entender | Fallos explícitos y localizados; cero estado inválido |
| Esquema DB | Tipos Supabase autogenerados (`supabase:gen`) | Entender | El agente conoce el shape real de los datos |
| Arquitectura | Co-localización `src/features/<dominio>/` + nombres `<feature>.<rol>.ts` | Leer | Menos tokens de contexto por tarea |
| Fronteras | Barrel `index.ts` por feature + ESLint sin deep imports | Cambiar | Grafo de dependencias limpio y predecible |
| Routing | `app/.../route.ts` delgado que delega a la feature | Leer/Cambiar | Co-localización sin pelear con Next |
| Consistencia | Generador/plantilla de features | Cambiar | Patrón único que el agente replica sin error |
| Errores | Logger "GPS": `archivo`/`linea`/`codigo` (kit agentic-logging) | Verificar | Corrección quirúrgica sin exploración heurística |
| Contexto | `CLAUDE.md` (no `ai.md`) con comandos, convenciones y "done" | Entender | El agente arranca cada sesión alineado |
| Bootstrap | Clone→install→dev reproducible; `.env.example`; seed | Arrancar | El agente y el CI parten de un estado conocido |

---

## Parte 4 — Checklist mínimo para empezar hoy (el 80/20)

Si solo haces seis cosas, que sean estas:

1. **`tsconfig` en `strict`** y un script **`npm run verify`** (typecheck + lint + test), replicado tal cual en CI.
2. **`CLAUDE.md`** (no `ai.md`) en la raíz, corto: stack, comandos, convenciones y definición de "done".
3. **Co-localización por feature** en `src/features/<dominio>/`, nombres `<feature>.<rol>.ts`, y un `index.ts` por feature. Routes en `app/` que delegan.
4. **Zod en la frontera** + `z.infer` para los tipos + **env tipado** + **tipos de Supabase autogenerados**.
5. **Kit `agentic-logging` instalado** (logs como GPS; ya lo tienes).
6. **Un generador de features** (o una plantilla documentada) para clonar el patrón de forma idéntica.

Con esto, los cuatro pasos del bucle del agente quedan baratos: lee poco, entiende contratos explícitos, cambia siguiendo un molde y verifica en un comando.
