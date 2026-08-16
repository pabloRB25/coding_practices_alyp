---
name: alyp-exec
version: 1.0.0
provides: [execution-loop]
requires: [orchestration]
description: >
  Loop de ejecución de tareas de programación completas de Alyp Studio — Opus orquesta y VALIDA, Sonnet ejecuta y se autovalida, Haiku hace lectura barata. Define el contrato de ida y vuelta (Contrato de Tarea → Reporte de Tarea), el ledger en disco, las olas paralelas y los tres gates mecánicos que hacen falsable el veredicto del orquestador. Invocar al EJECUTAR un plan, spec o conjunto de tareas de programación (no al diseñarlo): cuando vayas a despachar subagentes para implementar, refactorizar, migrar o barrer un codebase. Dos modos sobre las mismas estructuras — A conversacional (tool Agent, humano en el medio) y B harness (tool Workflow, plan cerrado). Complementa a devstral-orchestration, que define QUIÉN hace cada cosa; este define CÓMO fluye el trabajo. Perfil de contracts/orchestration.md (invariantes 1-7).
---

# alyp-exec — loop de ejecución Opus↔Sonnet

> **Guard de subagentes**: si te despacharon COMO ejecutor de una tarea, este
> skill no te aplica salvo §5 (tu autovalidación) y §6 (cómo se escribe tu
> reporte). No orquestes.

**Qué define este skill**: cómo fluye una tarea de programación de punta a punta.
**Qué NO define**: quién hace cada cosa (eso es `devstral-orchestration`), ni cómo
se diseña el plan (eso es `brainstorming` + `writing-plans`). Empieza cuando ya
hay algo que ejecutar.

## 1. Principio raíz

El costo dominante no lo fija cuántos agentes despachás, sino **el tamaño de tu
contexto de orquestador**: se re-envía cada turno y se acumula toda la sesión. Un
token en el contexto de un subagente se paga una vez y muere con él.

**Corolario**: offloadear más NO se consigue despachando más, sino **impidiendo
que el resultado del trabajo vuelva crudo a tu ventana**. Un despacho cuyo
resultado se vuelca entero en tu contexto movió el trabajo y trajo el costo.

Tres razones lo sostienen, no una: **costo** (el más débil — el prompt caching lo
abarata), **degradación de atención** (un orquestador con la ventana llena de repo
razona peor sobre el plan) y **supervivencia a la compactación** (lo que está en
la ventana se pierde; lo que está en el ledger, no).

## 2. Reglas duras

| # | Regla |
|---|---|
| **R1** | **No leés código.** Ni archivos, ni diffs completos, ni salidas crudas de test, ni los reportes archivados en bloque. Si necesitás saber algo del repo, lo pregunta un `explorador` y devuelve ≤30 líneas con anclas `archivo:línea`. |
| **R2** | **Todo lo que entra a tu contexto tiene formato fijo y tope de líneas.** |
| **R3** | **El estado vive en disco.** El ledger es la memoria de trabajo; tu ventana es caché descartable. |
| **R4** | **Ningún ejecutor devuelve trabajo sin verde propio** (§5). |
| **R5** | **Validás por evidencia, no por relectura.** Abrís código solo ante los cuatro disparadores de §7.3. |
| **R6** | **La evidencia que decide un veredicto la generás vos, no el juzgado** (§7.1). Contrato `orchestration` invariante 7. |

## 3. Las tres estructuras

Idénticas en ambos modos (§9). Son el contrato del sistema.

1. **Contrato de Tarea** (ida, lo escribís vos) — plantilla y reglas en
   `references/contrato-tarea.md`.
2. **Reporte de Tarea** (vuelta, lo escribe el ejecutor, tope 40 líneas) —
   `references/reporte-tarea.md`.
3. **Ledger** en `.claude/run/<slug>/` — lo crea `assets/ledger-init.sh`:
   ```
   estado.md          # UNA línea por tarea: <id> <estado> <riesgo> <ola>  ← tu única vista
   contratos/<id>.md  # los contratos emitidos
   reportes/<id>.md   # los reportes completos (NO los releés en bloque — R1)
   gates/<ola>.txt    # salida de los gates mecánicos
   ```

## 4. F0–F2 · Encuadre, reconocimiento y ola

**F0 · Encuadre** (vos, inline). Clasificás riesgo (§7.2), particionás y emitís
contratos.

> **Partición por archivos disjuntos**: dos tareas de la misma ola no pueden
> compartir archivos en su allowlist. Si el solapamiento es inevitable →
> serializá en olas distintas, o aislá con `isolation: "worktree"` (solo Modo B).

**F1 · Reconocimiento** (un `explorador` con `model: "haiku"`, UNA vez por ola).
Junta el mapa mínimo compartido —firmas, convenciones, ubicaciones— que vas a
**pegar** en el campo `contratos` de las N tareas. Se paga exploración una vez y
se amortiza sobre toda la ola. Si la ola es de una sola tarea, salteala: no hay
nada que amortizar.

**F2 · Ola** (N ejecutores en paralelo, un solo mensaje / un solo `parallel()`).
Cada uno recibe su contrato cerrado.

> Si no podés escribir un contrato cerrado, la tarea **no está lista para
> despacharse**: le falta F1, o le falta diseño. Nunca despaches un prompt
> exploratorio ("mirá el repo y arreglá X").

## 5. F3 · Autovalidación (dentro de cada ejecutor)

Antes de devolver, el ejecutor corre el `verificacion` de su contrato. Si falla,
itera por su cuenta hasta agotar `presupuesto` (default 2). Si no cierra,
devuelve `❌` con diagnóstico — **nunca un parche a medias ni un "creo que anda"**.

Esta fase es la que hace posible offloadear volumen: sin ella, cada tarea
devuelta te cuesta a vos un ciclo de verificación.

## 6. Formato de vuelta

Ver `references/reporte-tarea.md`. Lo esencial: **el campo `evidencia` del reporte
es informativo, no probatorio**. Orienta tu juicio; no lo funda. La prueba se
regenera en F4a.

## 7. F4 · Validación — la parte que no podés delegar

### 7.1 F4a · Gates mecánicos (sin juicio, sin razonamiento)

> **Por qué existen**: si la evidencia que validás la generó la parte juzgada, tu
> veredicto no es falsable — es un sello de goma. Y es forjable sin mala fe:
> salida stale, cwd equivocado, un comando que pasa en vacío (0 casos
> matcheados → exit 0), o reward-hacking sobre el propio test.

Tres gates, **piso para todo nivel de riesgo, incluido riesgo 0**. Comandos
concretos por stack en `references/gates.md`.

| Gate | Qué hace | Por qué es independiente |
|---|---|---|
| **G1 · Re-ejecución** | Corrés el `verificacion` literal del contrato, de tu lado. Un `Bash` por tarea o uno agregado por ola. | Ese comando lo escribiste vos **antes** de que el ejecutor trabajara. Esa anterioridad es lo que lo vuelve falsable. |
| **G2 · Allowlist** | `git diff --name-only` contra la allowlist. Archivo fuera = `❌` automático, sin juicio. | Binario, no interpretable. Junto con la exclusión de tests del contrato, cierra el reward-hacking. |
| **G3 · Gate de ola** | Typecheck + suite completa antes de despachar la ola siguiente. | La partición por archivos disjuntos **no** garantiza independencia semántica (tipos compartidos, contratos de API). Es lo único que caza integración rota entre tareas individualmente verdes. |

Los tres son comandos, no razonamiento: re-ejecutar cuesta órdenes de magnitud
menos que releer diffs. Con G1–G3 en su lugar, el muestreo adversarial es
**opcional** (p. ej. 1-de-N en riesgo 1), no estructural.

### 7.2 F4b · Juicio escalonado (solo sobre lo que pasó F4a)

| Riesgo | Qué mirás |
|---|---|
| **0** — mecánico, aislado | Nada más. G1–G3 verdes = aceptado. Sin lectura de código. |
| **1** — normal | Reporte + `git diff --stat` + **solo los hunks que el reporte señala** en `riesgos`. |
| **2** — auth, RLS, dinero, PII, migraciones, irreversibles | `revisor` con `model: "opus"` sobre el diff. **La firma final es tuya.** Nunca baja de Opus. |

### 7.3 Disparadores de lectura (únicas excepciones a R1)

1. Mismatch entre el reporte y G1 (dice ✅, el gate dice rojo).
2. Riesgo 2.
3. El reporte declara algo en su campo `riesgos`.
4. Tercer fallo consecutivo sobre la misma tarea.

Fuera de estos cuatro, leer código es una **violación del protocolo**, no una
precaución.

## 8. F5 · Cierre y reintentos

**F5 · Integración**: actualizás `estado.md`, armás la ola siguiente, y sintetizás
para el usuario **solo al cierre** (no ola por ola).

**Ante `❌`, clasificá la falla antes de escalar** — escalar sin clasificar quema
presupuesto:

| Causa | Acción |
|---|---|
| **Contrato ambiguo o roto** | Vuelve a vos: se arregla el contrato. Darle más nafta al ejecutor es re-derivar un contrato roto. |
| **Ejecución** (el contrato era bueno) | Vuelve al **mismo** subagente con el defecto anotado: su contexto ya está caliente y es lo más barato del sistema. |
| **Entorno / integración** | Lo caza G3. Es problema de ola, no de tarea. |

## 9. Modos de ejecución

**Una doctrina, dos ejecutores.** Las tres estructuras (§3), el loop (§4–§8) y las
reglas duras (§2) son **idénticas e innegociables** en ambos modos. Solo cambia
quién ejecuta el control de flujo: el modelo (A) o un script (B).

> **Regla anti-divergencia**: si un modo no puede cumplir una palanca, la palanca
> se declara **no disponible** en ese modo. No se emula ni se reinterpreta.

**Routing — por estado del plan, NO por duración.** Una tarea larga y exploratoria
es el peor caso para un harness.

| Condición | Modo |
|---|---|
| Plan cerrado + tareas homogéneas + verificación programática | **B** |
| El plan muta entre olas; hay decisiones que dependen de la ola anterior | **A** |

**Modo A — conversacional** (tool `Agent`, varias tool calls en un mensaje).
Ventaja decisiva: el humano puede intervenir a mitad de camino.
**Palanca no disponible**: la tool `Agent` **no expone `effort`** — solo `model`.
Los subagentes heredan el esfuerzo de la sesión, y la escalación de esfuerzo de
§10 **no es operable acá**. No intentes setear un parámetro que no existe; el
único reintento disponible es el de §8.

**Modo B — harness** (tool `Workflow`): `effort` y `model` por etapa,
`pipeline()` sin barreras, `resumeFromRunId`, `isolation: "worktree"`. Esqueleto
en `references/modo-b-workflow.md`.

> ⚠️ **Dos reglas duras de Modo B.**
> 1. Sin humano en el loop, **G1–G3 y la firma de riesgo 2 son ETAPAS del
>    pipeline**, no juicio discrecional: ahí el orquestador es un script y un
>    script no ejerce discreción.
> 2. **Lanzar el Workflow ES ejecutar el plan** — incluso en dry run. Cae bajo la
>    Regla #0: F0 produce el script y **ahí parás** hasta el visto bueno explícito
>    del usuario. Escribir el harness no es autorización para correrlo.

## 10. Esfuerzo y modelo

> **El modelo escala con lo que está en juego. El esfuerzo escala con la
> ambigüedad.** Ejes independientes; confundirlos lleva a pagar `xhigh` por todo.

| Etapa | Modelo | Effort |
|---|---|---|
| Reconocimiento / exploración (F1) | haiku | `low` |
| Etapas mecánicas (codemod, scaffold, formato) | haiku / sonnet | `low`–`medium` |
| **Implementación con contrato cerrado (F2)** | **sonnet** | **`high`** |
| Review no-crítico (riesgo 1) | sonnet | `high` |
| Verify / juez adversarial / riesgo 2 (F4b) | opus | `xhigh` |
| — | — | `max`: nunca por default |

**Por qué `high` y no `medium` en implementación** — no por lo que parece. El
contrato cerrado elimina ambigüedad, y ese argumento solo llevaría a `medium`. El
motivo real es que **R4 mete el debugging adentro del mismo agente**: cuando el
primer intento falla la verificación, el esfuerzo paga exactamente ahí. Y esos
reasoning tokens se pagan una vez y mueren con el subagente.

**Escalación (solo Modo B)**: ante el primer fallo *de ejecución*, subí
**esfuerzo** antes que modelo — es la palanca barata. Si falla otra vez, subí
tier. Nunca las dos a la vez: después no sabés cuál te salvó. Siempre después de
clasificar la falla (§8).

## 11. Anti-patrones (prohibidos por nombre)

1. **Abrir un archivo "para chequear"** fuera de los cuatro disparadores de §7.3.
2. **Ping-pong de correcciones a través tuyo.** Ante `⚠`/`❌` de ejecución la
   corrección vuelve al mismo subagente. Re-despachar uno nuevo lo hace
   re-explorar todo; corregirlo vos es el peor de los tres.
3. **Olas de una sola tarea** (pagás setup, perdés paralelismo, F1 no amortiza).
4. **Prompts exploratorios** en vez de contrato cerrado.
5. **Resúmenes narrativos** de vuelta.
6. **Aceptar un ✅ sin G1.** Un reporte verde sin re-ejecución independiente no es
   un veredicto: es un sello de goma.

## 12. Métricas y alarmas

- **Ratio de orquestación**: ≤20% del output total en tu contexto.
- **Alarma de degradación**: si editaste un archivo o leíste >200 líneas en una
  tarea delegable, el loop se degradó → **pará y re-despachá**.
- **Cobertura de gates**: 100% de las tareas aceptadas pasaron G1, sin excepción
  documentable.

## 13. Frontera con los otros skills

| Skill | Frontera |
|---|---|
| `devstral-orchestration` | Define **quién** (tiers, matriz de routing, carril local, veredictos de hooks). `alyp-exec` define **cómo fluye**. Ante conflicto sobre el loop de ejecución, manda `alyp-exec`. |
| `brainstorming` / `writing-plans` | Producen lo que `alyp-exec` ejecuta. No los reemplaza. |
| `subagent-driven-development` | Mapeo de roles al ejecutar planes superpowers: `contracts/execution.md`. |
| `alyp-qa-standard` | Los comandos de `verificacion` y de G3 salen del catálogo `qa/flujos/` cuando el repo lo tiene. |
| `superpowers:verification-before-completion` | G1 es su forma ejecutable acá: evidencia antes que afirmación, generada por quien afirma. |
