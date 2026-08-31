# Diseño: skill `alyp-exec` — loop de ejecución Opus↔Sonnet

- **Fecha**: 2026-08-16
- **Estado**: diseño aprobado, pendiente de plan de implementación
- **Validado por**: consultor Fable (veredicto `⬆ FABLE`, 2026-08-16) — sus tres
  correcciones están incorporadas y marcadas con **[F]**
- **Reemplaza (parcialmente)**: `devstral-orchestration` como doctrina de
  ejecución de tareas de programación

---

## 1. Problema

`devstral-orchestration` v2.8/2.9 define **quién** hace cada cosa: 6 tiers,
matriz de routing, override de `model` por despacho, carriles por tamaño, tabla
de review. Lo que no define es **cómo fluye una tarea de programación completa
de punta a punta**: qué se le manda a un subagente, qué devuelve, cómo se valida
lo que devolvió, dónde vive el estado entre olas.

Ese hueco tiene un costo concreto: sin un contrato de ida y vuelta, el
orquestador termina leyendo repo para poder validar, y su ventana de contexto
—el recurso más caro del sistema— se llena de material que debería haber muerto
en el contexto de un subagente.

`alyp-exec` cubre ese hueco.

## 2. Alcance

**En alcance**: el loop de ejecución de tareas de programación completas con
tres tiers (Opus orquesta y valida · Sonnet ejecuta y se autovalida · Haiku
lectura barata), en Claude Code app y CLI interactivo, sobre las primitivas del
harness (tool `Agent`, tool `Workflow`, hooks).

**Fuera de alcance**:

- Modo headless (`claude -p`, cron, CI). Decisión del usuario, 2026-08-16.
- El carril local (Ollama / `delegate_to_devstral`): sale del camino crítico
  (~28 s fijos por delegación, medidos en este equipo) y queda como anexo
  opcional referenciado, no como obligación del loop. Ver §10.
- El consultor Fable: sigue siendo válvula de escape por invocación explícita,
  gobernada por `devstral-orchestration`. No es parte del loop.
- Escribir el plan/spec de la tarea del usuario. Eso es `brainstorming` +
  `writing-plans`. `alyp-exec` empieza cuando ya hay algo que ejecutar.

## 3. Principio raíz

> El costo dominante de una sesión agéntica no lo fija cuántos agentes se
> despachan, sino **el tamaño del contexto del orquestador**.

El contexto del orquestador se re-envía en cada turno y se acumula durante toda
la sesión. Un token que entra ahí se paga muchas veces. Un token que entra al
contexto de un subagente se paga una vez y muere con el agente.

**Corolario contraintuitivo**: offloadear más trabajo a Sonnet no se consigue
despachando más subagentes, sino **impidiendo que el resultado del trabajo
vuelva crudo al orquestador**. Un despacho cuyo resultado se vuelca entero en la
ventana de Opus no ahorró nada: movió el trabajo y trajo el costo de vuelta.

**[F] Matiz sobre el argumento.** Con prompt caching, el re-envío de contexto es
más barato de lo que sugiere la lectura ingenua. El argumento fuerte a favor de
las reglas R1–R3 no es únicamente el precio, sino **la degradación de atención**
(un orquestador con la ventana llena de repo razonea peor sobre el plan) y **la
supervivencia a la compactación** (lo que está en la ventana se pierde; lo que
está en el ledger, no). El skill debe fundamentarse en las tres razones, no solo
en el costo: si el caching mejora, el argumento de costo se debilita y los otros
dos siguen en pie.

## 4. Reglas duras

| # | Regla | Qué previene |
|---|---|---|
| **R1** | **El orquestador no lee código.** Ni archivos, ni diffs completos, ni salidas crudas de test, ni los reportes archivados en bloque. Si necesita saber algo del repo, lo pregunta a un explorador que devuelve ≤30 líneas con anclas `archivo:línea`. | El leak principal: "chusmear para validar". |
| **R2** | **Todo lo que entra al orquestador tiene formato fijo y tope de líneas.** | Prosa narrativa = contexto caro comprado a precio de resumen. |
| **R3** | **El estado vive en disco.** El ledger es la memoria de trabajo; la ventana es caché descartable. | Que una tarea larga se re-explique a sí misma tras cada compactación. |
| **R4** | **Un ejecutor no devuelve trabajo sin verde propio.** Corre su comando de verificación; hasta 2 iteraciones por su cuenta; si no cierra, devuelve `❌` con diagnóstico, nunca un parche a medias. | Que el orquestador pague la verificación — que es donde muere el ahorro. |
| **R5** | **El orquestador valida por evidencia, no por relectura.** Abre código solo ante disparadores tasados (§6.5). | R1 aplicada en el momento de mayor tentación. |
| **R6** | **[F] La evidencia que decide un veredicto la genera quien juzga, no quien es juzgado.** | El defecto estructural del diseño original. Ver §6.4. |

## 5. Estructuras de datos

Las tres son idénticas en ambos modos de ejecución (§7). Son el contrato del
sistema; los modos son solo ejecutores distintos sobre ellas.

### 5.1 Contrato de Tarea (ida — lo escribe el orquestador)

```
## Tarea <id>
objetivo:      <una frase verificable, no cualitativa>
nivel:         opus | sonnet | haiku
riesgo:        0 | 1 | 2
archivos:      <allowlist explícita — el ejecutor NO toca fuera de esta lista>
contratos:     <firmas, tipos e interfaces PEGADAS acá, no referenciadas>
verificacion:  <comando literal>   # criterio: exit 0 y >0 casos ejecutados
prohibido:     <lo que no debe tocar ni asumir>
presupuesto:   <máx. intentos propios, default 2>
```

Dos decisiones de diseño no obvias:

**`contratos` va pegado, no referenciado.** Es la palanca de ahorro principal
del lado de la ida: el ejecutor recibe el contexto pre-masticado y no gasta 15
tool calls explorando para descubrir una firma. Ese mapa lo junta **un** explorador
barato **una vez por ola** (F1) y se reusa en las N tareas: se paga exploración
una vez, no N veces.

**[F] `archivos` excluye los archivos de test/verificación**, salvo que la tarea
*sea* escribir tests. Si el ejecutor puede modificar el test que lo valida, todo
el edificio de verificación se cae — es la puerta abierta al reward-hacking
(debilitar el test hasta que pase). Esta exclusión es una regla dura, no una
recomendación.

### 5.2 Reporte de Tarea (vuelta — lo escribe el ejecutor)

Tope duro: **40 líneas**. Formato fijo:

```
## Reporte <id>
veredicto:   ✅ | ⚠ | ❌
archivos:    <tocados + diffstat>
evidencia:   <comando ejecutado + últimas líneas de salida>
decisiones:  <≤3 bullets de decisiones no obvias>
riesgos:     <lo que el orquestador debe mirar, o "ninguno">
siguiente:   <sugerencia, o "ninguna">
```

Prohibido: volcar código, narrar el proceso, explicar línea por línea.

**El campo `evidencia` es informativo, no probatorio.** Sirve para orientar el
juicio del orquestador, no para fundamentarlo. La prueba se regenera en F4a.

### 5.3 Ledger (disco)

```
.claude/run/<slug>/
  estado.md          # una línea por tarea: <id> <estado> <riesgo> <ola>
  contratos/<id>.md  # los contratos emitidos
  reportes/<id>.md   # los reportes completos
  gates/<ola>.txt    # salida de los gates mecánicos de cada ola
```

**[F] R1 aplica también a `reportes/` y `gates/`**: el orquestador no los relee
en bloque. Su vista es `estado.md` (una línea por tarea); abre un reporte
individual solo cuando un disparador de §6.5 lo justifica.

El ledger es lo que permite reanudar tras compactación, tras un `/clear`, o al
día siguiente, sin reconstruir nada.

## 6. El loop

### F0 · Encuadre (orquestador, inline)

Clasifica riesgo, arma la partición y emite los contratos.

**Partición por archivos disjuntos.** Dos tareas de la misma ola no pueden
compartir archivos en su allowlist. Si el solapamiento es inevitable:
serializarlas en olas distintas, o aislarlas con `isolation: "worktree"` (solo
disponible en Modo B).

Salida: N Contratos de Tarea + una línea por tarea en `estado.md`.

### F1 · Reconocimiento (un explorador, una vez por ola)

Un solo `explorador` con `model: "haiku"` junta el mapa mínimo compartido —
firmas, convenciones, ubicaciones — que se pega en el campo `contratos` de las N
tareas. Se ejecuta una vez y se amortiza sobre toda la ola.

Si la ola es de una sola tarea, F1 se saltea (no hay nada que amortizar).

### F2 · Ola (N ejecutores en paralelo)

Todos los despachos de la ola van **en un solo mensaje** (Modo A) o en un solo
`parallel()`/`pipeline()` (Modo B). Cada uno recibe su Contrato de Tarea cerrado.

Nunca un prompt exploratorio ("mirá el repo y arreglá X"). Si el orquestador no
puede escribir un contrato cerrado, la tarea no está lista para despacharse: le
falta F1, o le falta diseño.

### F3 · Autovalidación (dentro de cada ejecutor)

Antes de devolver, el ejecutor corre el `verificacion` de su contrato. Si falla,
itera por su cuenta hasta agotar `presupuesto`. Si no cierra, devuelve `❌` con
diagnóstico — nunca un parche a medias ni un "creo que anda".

Esta fase es la que hace posible offloadear volumen: sin ella, cada tarea
devuelta le cuesta al orquestador un ciclo de verificación.

### F4a · Gates mecánicos **[F]** — sin juicio, sin razonamiento

> **El defecto que esta fase corrige**: en el diseño original, toda la evidencia
> que el orquestador "validaba" había sido generada por la parte juzgada. Eso es
> forjable incluso sin mala fe — salida stale, cwd equivocado, un comando que
> pasa en vacío (0 casos matcheados → exit 0), o reward-hacking sobre el test.
> Un veredicto sobre evidencia auto-reportada **no es falsable por diseño**.

Tres gates, **piso para todo nivel de riesgo, incluido riesgo 0**:

| Gate | Qué hace | Por qué es independiente |
|---|---|---|
| **G1 · Re-ejecución** | El orquestador corre el `verificacion` literal del contrato, de su lado. Un `Bash` por tarea, o uno agregado por ola. | El comando lo escribió el orquestador **antes** de que el ejecutor trabajara. Es la parte falsable del sistema. |
| **G2 · Allowlist** | `git diff --name-only` contra la allowlist del contrato. Archivo fuera = `❌` automático, sin juicio. | Mecánico, binario, no interpretable. Cierra el reward-hacking junto con la exclusión de tests de §5.1. |
| **G3 · Gate de ola** | Typecheck + suite completa antes de despachar la ola siguiente. | La partición por archivos disjuntos **no** garantiza independencia semántica (tipos compartidos, contratos de API entre tareas). Es lo único que caza integración rota entre tareas individualmente verdes. |

Costo: los tres son comandos, no razonamiento. Re-ejecutar un comando cuesta
órdenes de magnitud menos que releer diffs, así que la tesis económica se
sostiene entera.

Con G1–G3 en su lugar, el muestreo adversarial deja de ser estructural y pasa a
ser **opcional** (p. ej. 1-de-N en riesgo 1).

### F4b · Juicio escalonado (solo sobre lo que pasó F4a)

| Riesgo | Qué mira el orquestador |
|---|---|
| **0** — mecánico, aislado | Nada más. G1–G3 verdes = aceptado. Sin lectura de código. |
| **1** — normal | Reporte + `git diff --stat` + **solo los hunks que el reporte señala** en `riesgos`. |
| **2** — auth, RLS, dinero, PII, migraciones, irreversibles | Despacha `revisor` con `model: "opus"` sobre el diff. **La firma final es del orquestador.** Nunca baja de Opus. |

### 6.5 Disparadores de lectura (las únicas excepciones a R1)

El orquestador abre código cuando —y solo cuando— se cumple uno:

1. Mismatch entre el reporte y G1 (dice ✅, el gate dice rojo).
2. Riesgo 2.
3. El reporte declara un riesgo explícito en su campo `riesgos`.
4. Tercer fallo consecutivo sobre la misma tarea.

Fuera de estos cuatro, leer código es una violación del protocolo, no una
precaución.

### F5 · Integración

Actualiza `estado.md`, arma la ola siguiente, sintetiza para el usuario **solo
al cierre** (no ola por ola).

### 6.6 Árbol de reintento

Ante `❌`, **[F] primero clasificar la falla** — escalar sin clasificar quema
presupuesto:

| Causa del ❌ | Acción |
|---|---|
| **Contrato ambiguo o roto** | Vuelve al orquestador: se arregla el contrato, no se le da más nafta al ejecutor. Escalar effort o modelo acá es re-derivar un contrato roto. |
| **Ejecución** (el contrato era bueno) | Vuelve al **mismo** subagente con el defecto anotado — su contexto ya está caliente y es lo más barato del sistema. |
| **Entorno / integración** | Lo caza G3; se trata como problema de ola, no de tarea. |

## 7. Modos de ejecución

**Una doctrina, dos ejecutores.** Las tres estructuras (§5), el loop (§6) y las
reglas duras (§4) son **idénticas e innegociables** en ambos modos. Lo único que
cambia es quién ejecuta el control de flujo: el modelo (A) o un script (B).

**[F] Regla anti-divergencia**: si un modo no puede cumplir una palanca, la
palanca se declara **no disponible** en ese modo. No se emula ni se reinterpreta.
Es lo que evita que dos ejecutores se conviertan en dos doctrinas.

### 7.1 Routing entre modos — por estado del plan, no por duración

| Condición | Modo |
|---|---|
| Plan cerrado post-planning + tareas homogéneas + verificación programática | **B (harness `Workflow`)** |
| El plan muta entre olas; hay decisiones que dependen de lo que devuelva la ola anterior | **A (conversacional)** |

La duración **no** es el criterio: una tarea larga y exploratoria es el peor caso
para un harness. Si falta cualquiera de las tres condiciones, es Modo A.

### 7.2 Modo A — conversacional

El orquestador despacha olas con la tool `Agent`, varias tool calls en un mensaje.

- **Ventaja decisiva**: el humano puede intervenir a mitad de camino.
- **Palanca no disponible**: **la tool `Agent` no expone parámetro `effort`** —
  solo `model`. Los subagentes heredan el esfuerzo de la sesión. Por lo tanto la
  regla "escalá esfuerzo antes que modelo" (§8) **no es operable en Modo A** y el
  skill debe decirlo explícitamente, o un orquestador va a intentar setear un
  parámetro que no existe.
- Reintento en Modo A: el único disponible es el del §6.6 (mismo subagente,
  defecto anotado, contexto caliente).

### 7.3 Modo B — harness `Workflow`

Un script determinista orquesta el fan-out; el contexto del orquestador casi no
crece porque quien orquesta es el script.

- `agent()` acepta `effort` **y** `model` por etapa → §8 es plenamente operable.
- `pipeline()` sin barreras: el ítem 1 verifica mientras el ítem 5 implementa.
- `resumeFromRunId`: reanuda sin re-pagar lo ya hecho.
- `isolation: "worktree"`: única vía de aislar tareas que tocan los mismos archivos.

**[F] Peligro específico a cerrar**: sin humano en el loop, los gates G1–G3 y la
firma Opus de riesgo 2 tienen que ser **etapas del pipeline**, no juicio
discrecional del orquestador. En Modo B el orquestador es un script y un script
no ejerce discreción.

**[F] Regla #0 aplica de lleno**: lanzar un Workflow de Modo B **es ejecutar el
plan**, incluso en dry run. El skill debe decirlo explícitamente para que ningún
orquestador lo trate como "preparación". F0 produce el script; ahí se para hasta
el visto bueno explícito del usuario.

## 8. Esfuerzo y modelo

> **El modelo escala con lo que está en juego. El esfuerzo escala con la
> ambigüedad.** Son ejes independientes; confundirlos es lo que lleva a pagar
> `xhigh` por todo.

| Etapa | Modelo | Effort |
|---|---|---|
| Reconocimiento / exploración (F1) | haiku | `low` |
| Etapas mecánicas (codemod, scaffold, formato) | haiku / sonnet | `low`–`medium` |
| **Implementación con contrato cerrado (F2)** | **sonnet** | **`high`** |
| Review no-crítico (riesgo 1) | sonnet | `high` |
| Verify / juez adversarial / riesgo 2 (F4b) | opus | `xhigh` |
| — | — | `max`: nunca por default |

**[F] Por qué `high` y no `medium` en implementación** — la razón correcta no es
la que parece. El contrato cerrado elimina ambigüedad, y ese argumento por sí
solo llevaría a `medium`. El motivo real es que **R4 mete el debugging adentro
del mismo agente**: cuando el primer intento falla la verificación, el esfuerzo
paga exactamente ahí. Y esos reasoning tokens se pagan una vez y mueren con el
subagente — que es justo lo barato según la tesis del §3.

**Escalación (solo Modo B)**: ante el primer fallo *de ejecución*, subí
**esfuerzo** antes que modelo — es la palanca barata. Si falla otra vez, subí
tier. Nunca las dos a la vez: después no sabés cuál te salvó. Y siempre después
de clasificar la falla (§6.6).

*Nota de confianza*: Fable marcó confianza **media-alta** en este punto — falta
evidencia empírica (una corrida A/B `medium` vs `high` en implementación con
contrato cerrado diría si `high` sobre-provisiona). El costo de equivocarse
hacia arriba es bajo, así que no bloquea el diseño. Queda como medición pendiente.

## 9. Anti-patrones (prohibidos por nombre)

1. **El orquestador abriendo un archivo "para chequear"** fuera de los cuatro
   disparadores de §6.5.
2. **Ping-pong de correcciones a través del orquestador.** Ante `⚠`/`❌` de
   ejecución, la corrección vuelve al mismo subagente. Re-despachar uno nuevo lo
   hace re-explorar todo; corregirlo el orquestador es el peor de los tres.
3. **Olas de una sola tarea** (pagás setup, perdés paralelismo, F1 no amortiza).
4. **Prompts exploratorios** en vez de contrato cerrado.
5. **Resúmenes narrativos** de vuelta.
6. **Aceptar un ✅ sin G1.** Un reporte verde sin re-ejecución independiente no
   es un veredicto: es un sello de goma.

## 10. Relación con el ecosistema — cambios requeridos

Esta sección es la que evita dos redacciones paralelas de la misma regla.

| Artefacto | Cambio |
|---|---|
| `skills/devstral-orchestration/` | Se recorta a lo que solo él sabe: carril local/Ollama, gobernador, veredictos de hooks, `capacity.yaml`. Sus secciones de routing de ejecución pasan a apuntar a `alyp-exec`. |
| `contracts/orchestration.md` | **Enmienda a v1.2** (decidido 2026-08-16). Dos cambios: **(a)** invariante 2 — el tier mecánico pasa de *offloading obligatorio* a **opcional según entorno** (es lo que ya es de hecho: `mecanico_heavy: null` desde 2026-08-07). **(b)** invariante 7 nuevo — R6 + los gates G1/G2/G3 como piso agnóstico de aceptación de trabajo delegado. Cierra un hueco preexistente: el invariante 4 exige evidencia pero no declara **quién la genera**, que es justo la falla estructural. Sello de versión actualizado en el mismo PR (`README.md:128`). |
| `contracts/execution.md` | Mapeo de roles al ejecutar planes superpowers: debe reflejar el Contrato/Reporte de `alyp-exec`. |
| `~/.claude/CLAUDE.md` | El puntero de orquestación pasa a nombrar `alyp-exec` para ejecución y `devstral-orchestration` para el carril local. |
| `scripts/install.mjs` | La constante `SKILLS` (línea 29) es una **lista hardcodeada**: hay que agregar `'alyp-exec'` o el instalador no lo despliega. |
| `agents/*.md` | `implementador`, `explorador` y `revisor` se reusan tal cual. `alyp-exec` no crea agentes nuevos: cambia lo que se les manda y lo que se les exige de vuelta. |

## 11. Estructura del skill

```
skills/alyp-exec/
  SKILL.md                     # doctrina: §3–§9, compacta (objetivo ≤250 líneas)
  references/
    contrato-tarea.md          # plantilla + reglas de llenado + ejemplos
    reporte-tarea.md           # plantilla + qué está prohibido
    gates.md                   # G1–G3: comandos concretos por stack
    modo-b-workflow.md         # esqueleto de script Workflow con gates como etapas
  assets/
    ledger-init.sh             # crea .claude/run/<slug>/
```

## 12. Métricas

- **Ratio de orquestación**: ≤20% del output total en el orquestador.
- **Alarma de degradación**: si el orquestador editó un archivo o leyó >200
  líneas en una tarea delegable, el loop se degradó → parar y re-despachar.
- **Cobertura de gates**: 100% de las tareas aceptadas pasaron G1. Sin excepción
  documentable.

## 13. Reparto entre capas

El ecosistema tiene tres capas (`README.md:23`): `contracts/` son los invariantes
agnósticos (el "qué" y el "por qué", sin nombrar producto), `skills/` es el
perfil concreto (el "cómo"), `standards.yaml` es la adopción por repo.

`alyp-exec` es **capa 2**. Pero parte de lo que descubrimos diseñándolo es
**capa 1** y debe subir al contrato, o se pierde el día que exista otro perfil:

| Sube a `contracts/orchestration.md` v1.2 | Se queda en `skills/alyp-exec` |
|---|---|
| **R6** — la evidencia que decide un veredicto la genera quien juzga, no quien es juzgado | Modo A vs Modo B; tool `Agent` vs `Workflow` |
| **G1/G2/G3** como invariantes: re-ejecución independiente · allowlist que excluye tests · gate de integración por ola | Los comandos concretos de cada gate, por stack |
| El principio del contrato-de-tarea cerrado y del reporte con tope | Las plantillas concretas y el layout del ledger |
| La escalación de riesgo 0/1/2 con firma en el orquestador | La tabla de effort (`high`/`xhigh`), atada al harness |

Criterio: si la regla sigue siendo verdadera con otros modelos y otro stack, es
contrato. Si depende de una primitiva del harness, es skill.

## 14. Decisiones pendientes

1. **Medición `medium` vs `high`** en implementación con contrato cerrado (§8).
2. Si el recorte de `devstral-orchestration` va en el mismo plan de
   implementación o en uno posterior.
