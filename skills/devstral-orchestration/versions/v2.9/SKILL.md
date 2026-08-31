---
name: devstral-orchestration
version: 2.10.0
provides: [orchestration]
description: >
  Protocolo de orquestación multi-modelo v2.8 de Claude Code para Alyp Studio — Opus orquesta SIEMPRE, Fable es consultor de invocación explícita, offloading local OBLIGATORIO (el tier mecánico exige tool calling estructurado). El orquestador Opus (loop principal) rutea entre 6 roles: orquestador Opus, consultor Fable (invocación explícita, veredicto ⬆ FABLE), subagentes Opus (razonamiento pesado aislado), subagentes Sonnet (implementador/explorador/revisor), ejecutor local en dos tiers vía delegate_to_devstral (llamable directo por Opus o por Sonnet), y QA local por hooks. Invocar ANTES de orquestar o delegar por primera vez en la sesión, o para interpretar veredictos del hook (✅/⚠/❌/🚨). Versiones anteriores en versions/. Mapeo tier→modelo y límites del entorno en ~/.claude/capacity.yaml (contrato: contracts/orchestration.md).
---

# Orquestación multi-modelo v2.8 — Alyp Studio (Opus orquesta · Fable consulta · offloading obligatorio)

> **Frontera con `alyp-exec` (desde 2.10)**: este skill define **QUIÉN** hace
> cada cosa — tiers, matriz de routing, carril local, veredictos de hooks,
> consultor. **`alyp-exec` define CÓMO fluye el trabajo** — contrato de tarea,
> olas, gates de aceptación, ledger, modos A/B. Al **ejecutar** un plan o un
> conjunto de tareas de programación, invocá `alyp-exec`: ante conflicto sobre el
> loop de ejecución, manda él. Este skill sigue siendo la referencia para el
> routing, el carril local y la interpretación de veredictos del hook.
>
> **Capacity**: los nombres de modelos de este documento son el mapeo ACTUAL de
> `~/.claude/capacity.yaml` (si no existe: copiá `capacity.example.yaml` de este
> skill y avisá una vez). Doctrina = tiers (juez/razonador/obrero/barato/mecánico);
> ver `contracts/orchestration.md`. Cambia un modelo → se edita capacity.yaml,
> no este protocolo.

Objetivo: **máxima calidad al menor costo de tokens, usando TODOS los tiers
disponibles**. El costo dominante no es qué modelo trabaja, sino cuánto contexto
acumula el orquestador — que en v2.7 es **siempre Opus** (ver "¿Quién orquesta?").
Su contexto es el más caro que acumulás en la sesión: cada lectura/edición/salida
se re-envía cada turno. La regla madre:

> **Delegá hacia abajo TODO lo delegable y mantené tu contexto de orquestador
> mínimo: leé poco, delegá mucho, recibí resúmenes.** Cada subagente o delegación
> local aísla su propio contexto — solo vuelve el resumen. Vos retenés routing,
> síntesis y veredicto. Y hacia abajo del todo: **si el ejecutor local puede
> hacerlo, el ejecutor local LO HACE** (ver "Offloading obligatorio").

**Qué cambió vs v2.6 (→ v2.7.1)**:
1. **Se elimina la dualidad Fable/Opus**: el orquestador es **SIEMPRE Opus**,
   con autoridad plena. El "Modo Opus" de v2.5-v2.6 pasa a ser EL modo.
2. **Fable ya no orquesta**: existe únicamente como agente `consultor`
   (`model: "fable"`), de **invocación explícita** — el orquestador lo llama
   cuando duda de verdad o cuando el usuario lo pide; nunca es implícito.
3. **Offloading local OBLIGATORIO**: si una subtarea es ejecutable por el tier
   local, VA al local. Deja de ser una optimización opcional (la vieja regla
   "para velocidad pura, el local es opcional" queda derogada).
4. **El local es llamable DIRECTO** por el orquestador Opus (delegación directa)
   y por el `implementador` Sonnet (cascada). Ya era así en tooling; ahora es
   doctrina explícita.
5. Perfil de ESTE equipo validado y documentado (sección "Perfil del equipo",
   medido 2026-07-16).

**Qué cambió en 2.7.2** (parche de validación, misma doctrina): el tier mecánico
exige **tool calling estructurado** — requisito nuevo, ver abajo. Se descartó
`qwen2.5-coder:3b` como ejecutor (0/5 medido: emite la llamada como texto y no
ejecuta nada, pero el loop lo reporta como éxito) y el `mecanico_light` pasó a
`qwen3:4b` (4/4, mismo footprint). Cambio de capacity, no de protocolo.

**v2.8**: carriles por tamaño, routing de review, precisión de offloading de
tests, spec-review por riesgo, referencia a contracts/execution.md.

**v2.9**: el offloading local pasa de "toda tarea mecánica, en serie" a **lote +
solapamiento** con umbral numérico (≥3 archivos o ≥1 min, y algo que hacer en
paralelo), tras medir 1 delegación en 1.486 ediciones y ~28 s de costo fijo por
delegación. El tier heavy se intenta siempre aunque haya presión de RAM (slot
exclusivo, QA descargado, KV reducido, degradación a light). Perfil de RAM
corregido con valores medidos. El MCP pasa a leer `capacity.yaml` de verdad.

## ¿Quién orquesta? (leé esto primero)

**Guard de subagentes**: si fuiste despachado como subagente para ejecutar una
tarea específica (implementador, explorador, revisor, consultor o similar), NO
sos el orquestador: ignorá las secciones de orquestación de este skill. Solo te
aplican la cascada local (`delegate_to_devstral` y su gobernador) y el estándar
de evidencia.

**El modo estándar de este equipo es: Opus orquesta.** Tu system prompt declara
qué modelo sos ("You are powered by …"). Ramificá:

| Sos | Modo | Reglas |
|---|---|---|
| **Opus** | **Estándar** | Todo este skill tal cual. Autoridad plena: routing, razonamiento pesado (inline o delegado a subagentes Opus) y veredicto final. El `consultor` Fable es tu único nivel superior, por invocación explícita. |
| **Fable** | Excepcional | El usuario te eligió como loop a mano. Orquestá con este skill igual, pero el `consultor` NO aplica (sos el techo — no te consultes a vos mismo). Avisá UNA vez que el modo estándar del equipo es Opus (`/model claude-opus-4-8`). |
| **Otro** (Sonnet, Haiku, …) | Degradado | Avisá UNA vez ("el protocolo asume Opus como orquestador") y orquestá con este skill, pero la consulta al `consultor` es OBLIGATORIA (no por duda) para: seguridad crítica, acciones irreversibles y diseño de arquitectura. El criterio pesado nunca queda en el tier obrero. |

## Los 6 roles

| Nivel | Modelo | Rol |
|---|---|---|
| **Orquestador (tier razonador+juez operativo)** | **Opus (vos, el loop principal — SIEMPRE)** | Routing, descomposición de planes, síntesis de resultados, resolución de ambigüedad con el usuario, razonamiento pesado (inline o delegado), **veredicto final** de seguridad crítica y de merge/prod. Trabajo inline solo cuando delegar cuesta más que hacerlo (cambios de <5 min, decisiones de 1 línea). |
| **Consultor (tier juez supremo)** | **Fable (agente `consultor`, `model: "fable"`)** | **Invocación explícita**: el orquestador lo llama ante duda real (señales abajo) o a pedido del usuario. Destraba, decide y arbitra UNA consulta puntual desde contexto aislado, con paquete cerrado. Devuelve veredicto `⬆ FABLE`. Es el recurso más caro del sistema: desempate, no par de programación. |
| **Razonador delegado** | **Opus (subagentes, `model: "opus"` en la tool Agent)** | Razonamiento pesado que conviene AISLAR del contexto del loop: análisis de seguridad crítica (borrador — vos aprobás), diseño de arquitectura detallado a partir de tu spec, debugging endiablado, juez adversarial de evidencia, review final pre-prod (borrador). |
| **Obrero** | **Sonnet (subagentes, default de los agentes)** | Implementación, research, debugging normal, review no-crítico, verificación en browser. **Cascada obligatoria**: delega a su vez lo mecánico al local. |
| **Mecánico** | **Local (`delegate_to_devstral`) — OBLIGATORIO cuando puede** | Tareas mecánicas, verificables e inequívocas. **`tier="light"` (mecanico_light) = default rápido**; `tier="heavy"` (mecanico_heavy) solo para mecánico-con-razonamiento (en este equipo no co-reside cómodo — ver Perfil). Lo llama DIRECTO el orquestador Opus o el Sonnet que tenga la subtarea. Fallback cloud: `model: "haiku"` SOLO si Ollama está apagado o el gobernador saturado. |
| **QA (qa-automático)** | **mecanico_light (hooks)** | Veredicto automático tras Edit/Write y tras cada delegación. Modelo chico → residente junto al ejecutor, sin swap. |

Los agentes `implementador`/`explorador`/`revisor` declaran `model: sonnet` en
su frontmatter, pero **el parámetro `model` de la tool Agent lo sobreescribe por
despacho**: el mismo `revisor` despachado con `model: "opus"` es tu revisor de
seguridad; el mismo `explorador` con `model: "haiku"` es un buscador barato.
Un solo set de agentes, tres precios. El `consultor` es fijo `model: "fable"`.

## Offloading al local — por lote y en paralelo (v2.9)

> **El criterio NO es "¿esta tarea es mecánica?" sino "¿hay un LOTE mecánico que
> pueda correr MIENTRAS hago otra cosa?".** El carril local existe para robarle
> trabajo al contexto caro del orquestador, no para insertar latencia en el
> camino crítico.

> **Nota de contrato (v1.2)**: `contracts/orchestration.md` invariante 2 pasó el
> offloading al mecánico de *obligatorio* a **opcional según entorno**. El umbral
> de abajo ES la forma que toma esa opcionalidad en este perfil: dentro del
> umbral, delegar sigue siendo obligatorio; fuera de él, hacerlo inline no es una
> excepción a justificar. En el loop de `alyp-exec` el carril local queda **fuera
> del camino crítico** por decisión de perfil.

**Por qué cambió (medido 2026-07-26).** Una delegación cuesta **~28 s**, igual en
frío que en caliente — el costo es el loop de 2 iteraciones del ejecutor, no la
carga del modelo (hipótesis descartada por medición: `think:false` no mejora).
Un `Edit` inline cuesta ~2 s. La regla anterior ("si es mecánica, VA al local",
tarea por tarea, en serie) pedía cambiar 2 s por 28 s: se cumplió **1 vez en
1.486 ediciones** en la semana del 19 al 26 de julio. Una regla con 0,07% de
adherencia no protege nada; la reemplazamos por una que sí se puede sostener.

### Umbral de delegación (regla dura)

Delegá al local cuando se cumplan **las dos**:

1. **Lote**: ≥3 archivos mecánicos, o ≥1 minuto estimado de trabajo mecánico
   continuo. Una edición suelta de <30 s se hace inline — delegarla es perder
   tiempo, no ahorrarlo.
2. **Solapamiento**: en el momento de delegar tenés otra cosa que hacer
   (subagentes cloud en vuelo, review, síntesis, otra rama del plan). El carril
   local corre mientras vos avanzás; si te quedás esperando los 28 s, no delegues.

Cuando ambas se cumplen, **delegar es obligatorio**: no es preferencia de estilo.
Cuando no se cumplen, hacerlo inline **no es una violación** del protocolo.

**Formulación operativa:** al descomponer un plan, agrupá lo mecánico en UN lote
por ola y despachalo junto con la ola cloud (§Scheduler de 2 carriles). El
paralelismo es lo que vuelve gratis el carril local; en serie siempre pierde.

**Telemetría**: el monitor muestra `offloading N deleg / M ediciones` de la
sesión. Si el ratio queda en 0 durante días de trabajo mecánico, el carril está
muerto y hay que revisar por qué — no asumir que "no hubo nada delegable".

"Puede ejecutar" se decide con dos preguntas:

1. **¿Es mecánica + verificable mecánicamente + spec inequívoco?** (test pasa,
   tsc limpio, lint limpio) → `tier="light"`. Ejemplos: tests unitarios,
   codemods, CRUD por template, fixes tsc/lint, JSDoc, schemas Zod desde
   ejemplos, boilerplate, renames/extracts multi-archivo.
2. **¿Es mecánica pero exige algo de razonamiento acotado?** (refactor con
   decisiones locales, transformación con casos borde enumerables) →
   `tier="heavy"`, de a UNA (no co-reside cómodo en este equipo).

Quién delega: **el que tiene la subtarea en las manos** — el orquestador Opus
directo (sin pasar por un Sonnet intermediario si la subtarea ya está
especificada) o el `implementador` Sonnet en cascada. La supervisión y el QA
corren en el contexto de quien delegó.

**Tests — precisión**: al local van solo tests MECÁNICOS (cobertura adicional,
casos borde desde ejemplos, schemas Zod), siempre después del verde. El test
que DEFINE un comportamiento (rojo inicial de TDD) lo escribe quien implementa
— delegarlo al local es test-after disfrazado y viola el protocolo.

### Requisito duro del tier mecánico: tool calling estructurado

El ejecutor local **debe** emitir `tool_calls` estructurados. Un modelo que
escupe la llamada como texto en `content` **no ejecuta nada** — y el loop del MCP
lo interpreta como "terminó" y devuelve `[El ejecutor local completó la tarea]`.
Resultado: **éxito falso silencioso**, el peor modo de falla posible bajo una
regla de offloading obligatorio.

- Verificalo con una **llamada real** que devuelva `tool_calls`. **NO alcanza**
  con `capabilities: [tools]` de `/api/show`: un modelo puede declararlo y
  fallar igual (medido).
- Ante la duda, el síntoma es inconfundible: el resumen del ejecutor trae un
  bloque JSON con `{"name": "write_file", ...}` y el trace de `--- acciones ---`
  viene **vacío**. Eso es un no-op, no un trabajo hecho: no lo aceptes.
- Modelos chicos: el tamaño no predice la capacidad. Medido 2026-07-16 en este
  equipo — `qwen2.5-coder:3b` (1.9 GB) **0/5**; `qwen3:4b` (2.5 GB) **4/4**.

**Únicas excepciones** (todas se agotan antes de saltarse el local):
- **Gobernador saturado** (ya hay `max_delegaciones_vivas` = 2 delegaciones
  locales vivas) Y hay urgencia real de wall-clock → `model: "haiku"`.
- **Ollama apagado / modelo sin descargar** (`[QA local no disponible]` o error
  del MCP) → `model: "haiku"` y avisá UNA vez.
- **El contexto necesario excede `num_ctx` (16384)** o el spec es ambiguo →
  no es ejecutable por el local: va a Sonnet (mecánico + ambiguo → Sonnet).
- **Seguridad/secretos/infra/irreversibles**: nunca fueron delegables al local
  y siguen sin serlo.
- **No hay lote ni solapamiento** (ver Umbral): la tarea va inline. Documentado
  como decisión normal, no como excepción a justificar.

## Carriles por tamaño de trabajo (routing de proceso)

El carril se decide UNA vez al entrar el pedido; ante duda, subí un carril.

| Trabajo | Entrada | Cadena |
|---|---|---|
| Bug | superpowers:systematic-debugging | diagnóstico → test rojo → fix → verify. SIN brainstorming ni plan |
| Ajuste chico (comportamiento nuevo, alcance trivial) | brainstorming versión corta | diseño de 3 frases + aprobación → implementación con TDD. SIN writing-plans |
| Feature | cadena completa | spec → plan → subagent-driven (contracts/execution.md) → review → finishing |
| Plataforma / épica | PRD primero (write-spec) | partir en specs de feature → N cadenas completas |
| Legacy sin estándar | guides/remediacion-legacy.md | auditar (manifest regla 3) → plan de remediación → carril normal |

El carril corto no saltea el diseño: lo dimensiona. La regla boy-scout aplica
en todos: feature nueva sigue el estándar; lo existente no se reestructura
salvo proyecto de remediación explícito.

## Routing de review (tabla única)

| Situación | Mecanismo |
|---|---|
| Review por tarea (subagent-driven) | `revisor` sonnet, con checklist de capa del engineering-baseline |
| Review final pre-merge / seguridad crítica | `revisor` model opus (borrador de veredicto; el orquestador aprueba) + security-review si toca auth/RLS/secretos/dinero |
| Diff chico fuera de un plan | `/code-review` del harness directo |
| Spec que toca auth/RLS/dinero/irreversibles | review adversarial del spec ANTES de writing-plans (`revisor` opus o `consultor`) |
| Feedback recibido | superpowers:receiving-code-review (rigor, no aceptación performativa) |

`requesting-code-review` define CUÁNDO pedir review; esta tabla define QUIÉN.

## Matriz de routing

| Tarea | Nivel |
|---|---|
| Routing, descomposición del plan en subtareas | **Opus (vos)** |
| Resolución de ambigüedad de requisitos (con el usuario) | **Opus (vos)** |
| **Veredicto final** de seguridad crítica, merge a prod, cambios irreversibles | **Opus (vos)** — podés pedir borrador a un subagente Opus; la firma es tuya |
| Síntesis e integración de resultados de subagentes | **Opus (vos)** |
| Análisis de seguridad crítica: auth, JWT/sesión, RLS, secretos, pagos, PII, trust boundaries, middleware de acceso | **Subagente Opus** (`revisor` con `model:"opus"`) → vos aprobás |
| Diseño de arquitectura detallado desde tu spec de alto nivel | **Subagente Opus** (`model:"opus"`) → vos aprobás |
| Debugging difícil (heisenbug, race, cross-system) | **Subagente Opus** (`implementador` con `model:"opus"`) |
| Juez adversarial de evidencia / review final pre-prod (borrador) | **Subagente Opus** (`revisor` con `model:"opus"`) |
| Implementación de feature multi-archivo con lógica no trivial | **Sonnet** (`implementador`) — con cascada local obligatoria |
| Research / mapeo del codebase / convenciones | **Sonnet** (`explorador`) |
| Debugging con razonamiento normal | **Sonnet** (`implementador`) |
| Code review de cambios no-críticos | **Sonnet** (`revisor`) |
| Verificación en browser (chrome-devtools) | **Sonnet** (`implementador`) |
| Búsquedas amplias baratas, triage de logs, resúmenes de archivos | **Haiku** (`explorador` con `model:"haiku"`) |
| Tests unitarios, codemods, fixes de tsc/lint mecánicos | **Local light** (OBLIGATORIO; Haiku solo por excepción del gobernador) |
| CRUD/feature por template (assets de `alyp-agentic-standards`) | **Local light** |
| JSDoc, secciones de README, schemas Zod desde ejemplos | **Local light** |
| Boilerplate, scaffolding, refactor mecánico (rename/extract) multi-archivo | **Local light** (heavy si exige razonamiento acotado, de a una) |
| Duda real del orquestador / arbitraje que no cerrás / pedido del usuario | **Consultor Fable** (`consultor`) — invocación explícita |

## Principios de routing

1. **Offloading obligatorio hacia el local** (sección propia, arriba). El local
   primero; el cloud barato es la excepción documentada, no la alternativa cómoda.
2. **Seguridad crítica nunca baja de Opus, y el veredicto nunca baja del
   orquestador.** Un subagente Opus puede analizar auth/RLS/pagos y proponer;
   la aprobación y cualquier cambio irreversible (migración destructiva, deploy
   prod, borrado) los decidís vos, con el usuario cuando corresponda. Si dudás,
   escalá al `consultor` — explícitamente.
3. **Si dudás del nivel, subí uno.** El costo de un error supera el ahorro.
4. **Los subagentes Opus son caros y lentos: despachalos con spec, no con
   exploración.** Antes de un subagente Opus, un `explorador` (Sonnet/Haiku)
   junta el contexto; Opus recibe scope exacto + evidencia y devuelve análisis,
   no paseos por el repo.
5. **Cascada**: un subagente Sonnet delega a su vez lo mecánico al local (misma
   regla de offloading obligatorio). El QA y la supervisión corren en el
   contexto de quien edita, no en el tuyo.
6. **No degrades tu turno a proxy.** Si te descubrís leyendo archivos completos
   o iterando ediciones inline en una tarea delegable, pará y despachá.

## Consultor Fable — invocación explícita

Fable no orquesta ni aparece solo: **lo llamás vos**, como agente `consultor`,
cuando se cumple una señal de duda real o el usuario lo pide. Señales (guía,
no gate):

- 2 intentos fallidos sobre el mismo problema (espejo del ⚠ N/2 local);
- evidencia contradictoria o insuficiente ante una acción irreversible;
- conflicto entre veredictos de subagentes;
- decisión de arquitectura con trade-offs que no lográs cerrar;
- el `revisor` marcó `🔴 ESCALAR` y tu propio análisis no alcanza;
- el usuario pidió explícitamente "consultá a Fable".

**Disciplina de despacho (regla dura).** Nunca escales con exploración: el
paquete lleva scope exacto + evidencia anclada (`archivo:línea`, diffs, salidas
de comando) + la pregunta decidible + las opciones que ya consideraste. Si falta
evidencia, primero un `explorador` la junta. Una consulta = una pregunta.

**La cadena es de a un nivel.** Tus subagentes no escalan a Fable: escalan a
vos vía su resumen final, y vos decidís si consultás.

**Prohibido**: consultas headless a Fable vía `claude -p` desde Bash — costo
invisible y sin supervisión. La única vía es el agente `consultor`.

## Reglas de descomposición de planes (estándar ralph)

Cuando generes un plan/spec con subtareas (vos, o vía `writing-plans`), cada
subtarea debe poder correr **desatendida y ser juzgable**. Reglas duras:

1. **Concreta y verificable, nunca cualitativa.** ❌ "mejorar la calidad" →
   ✅ "el endpoint `/healthz` responde 200 en < 300 ms bajo `scripts/load_healthz.sh`".
2. **Sin intervención humana en la subtarea.** Ninguna puede "pedir credenciales",
   "esperar aprobación" ni "abrir un PR y esperar review". Lo que necesite el
   exterior se modela como precondición a obtener automáticamente, o se saca de
   alcance. (Las decisiones del usuario se resuelven al planificar, no dentro del
   bucle de ejecución.)
3. **Cada bloque cierra con su evidencia.** La última acción de un bloque de
   implementación es su checkpoint de evidencia reproducible (test que pasa,
   salida de comando, screenshot de browser), no un "listo". Es el insumo que el
   `revisor`/juez exige para dar un veredicto positivo.
4. **Esfuerzo declarado por bloque.** Anotá qué nivel del routing corresponde a
   cada bloque (Opus / Sonnet / Haiku / local-light / local-heavy / consultor),
   para no decidirlo a ojo en caliente: scaffold/boilerplate/tests mecánicos →
   local-light SIEMPRE; features normales → Sonnet (+cascada local); razonamiento
   difícil, seguridad y el juez adversarial → subagente Opus; veredicto y
   síntesis → vos; desempate → consultor.

## Despachar subagentes (tool Agent)

- `implementador` — implementa features/cambios siguiendo el estándar Alyp;
  **cascada local obligatoria** para lo mecánico. Dale plan + alcance + criterio
  de verificación.
- `explorador` — research read-only; devuelve `archivo:línea`, no volcados.
- `revisor` — review no-crítico; escala lo de seguridad crítica como `🔴 ESCALAR`
  (que vos re-despachás a un `revisor` con `model:"opus"` y aprobás).
- `consultor` — invocación explícita al tier Fable (sección propia, arriba).
- **Override de modelo por despacho**: `model: "opus"` para las filas de
  razonamiento pesado de la matriz, `model: "haiku"` para búsquedas/triage
  baratos. Sin override = Sonnet. El `consultor` es fijo `model: "fable"`.
- Mapeo de roles al ejecutar planes superpowers: `contracts/execution.md`
  (tabla normativa).

Despachá varios en paralelo (un solo mensaje con varias tool calls) cuando las
tareas son independientes. Cada agente devuelve un resumen; vos integrás y
decidís. Para fan-out grande con verificación adversarial, usá **Workflow**:
`agent(prompt, {model, effort})` permite fijar nivel por etapa — finders en
Sonnet, verify/judge en Opus con `effort: "high"`, etapas mecánicas en Haiku
con `effort: "low"`.

## Después de cada delegación local

El hook `supervise-devstral.py` emite un veredicto. Seguí:

1. **✅ APROBADO** — continuá.
2. **⚠ REINTENTO N/2** — re-delegá con el `delegate_to_devstral()` exacto que
   indica el hook (no edites el prefijo `CORRECCIÓN (intento N/M):`, el contador
   depende de él). Dale al local la oportunidad de autocorregirse.
3. **❌ No resuelto en 2 intentos** — no re-delegues; que lo corrija el
   `implementador` Sonnet que lo delegó (o corregí con Edit/Write/Bash si fue
   delegación directa tuya). Verificá que tsc/tests pasen.
4. **🚨 ESCALACIÓN por tope de iteraciones** — tomá el trace y completá la tarea
   con tus herramientas. Nunca dejes algo a medias sin avisar al usuario.
5. **🚨 ESCALACIÓN por NO-OP** — el ejecutor no ejecutó ninguna acción (respondió
   sin invocar herramientas, o emitió la tool call como texto = tool calling
   roto). NO re-delegues al mismo ejecutor: falla idéntico. Completá vos, o
   corregí `MODEL_LIGHT` si el diagnóstico apunta a un modelo sin tool calling.
   El hook detecta esto anclando en la confirmación real de escritura del trace
   (`OK: escrito …`), no en promesas del resumen — un "creé el archivo" sin esa
   confirmación es un no-op, no un trabajo hecho.

## QA automático en Edit/Write

`qa-review.py` revisa con el modelo QA local tras cada edición:
- **QA OK** — continuá.
- **Issues** — críticos (bugs/seguridad) se corrigen antes de seguir; menores se
  notifican y se sigue si no bloquean. El QA chico genera falsos positivos
  (race conditions inexistentes, "faltan tests" en scripts personales): evaluá,
  no apliques a ciegas.
- `[QA local no disponible]` = Ollama apagado o modelo sin descargar; no es error
  de tu trabajo. Avisá una vez, aplicá la excepción de offloading (Haiku) y seguí.

## Reglas generales

- Nunca aceptes trabajo delegado (local, Sonnet u Opus) sin su resumen/veredicto.
- Un subagente Opus también rinde cuentas: pedile evidencia anclada
  (`archivo:línea`, test, salida de comando) igual que al `revisor`.
- El nombre `delegate_to_devstral` y los archivos `*devstral*` se conservan por
  compatibilidad (settings/permisos); el modelo ejecutor real es el de capacity.yaml.
- Límites del entorno (RAM, tiers locales, delegaciones concurrentes, tamaño de ola):
  en `~/.claude/capacity.yaml`. Los valores medidos de ESTA máquina están en
  `~/local-llm-stack/ARCHITECTURE.md` y resumidos abajo en "Perfil del equipo".

## Scheduler de 2 carriles — paralelismo sin bloquear el equipo

Objetivo: **máxima velocidad de ejecución en paralelo**, sin que un carril ahogue
al otro y sin bloquear la máquina. Cloud y local usan cómputo distinto (infra de
Anthropic vs tu RAM) → **se solapan gratis**; el truco es saturar ambos a la vez.

```
Wall-clock ≈ profundidad_camino_crítico × latencia_etapa
Paralelismo_max = W_cloud + W_local
  W_cloud = min(10, unidades_independientes)   ← subagentes cloud (Opus+Sonnet+Haiku
                                                  comparten el cap min(16, cores−2);
                                                  en esta Mac (12c) = 10)
  W_local = OLLAMA_NUM_PARALLEL = 2            ← un modelo residente atiende 2 requests
```

**El cuello real es la descomposición, no el hardware** (los subagentes corren
en cloud, no en tus cores). Maximizá unidades independientes y el resto se acomoda.

### Reglas del scheduler

1. **Descomponé al grano más fino independiente** (por archivo / módulo de test /
   dimensión de review). Ese es el techo del paralelismo.
2. **Clasificá cada unidad → carril y tier:** mecánica + verificable + inequívoca
   → local (OBLIGATORIO; `light` default, `heavy` solo con razonamiento y de a
   una); razonamiento pesado → subagente Opus; ambigua o con lógica → Sonnet;
   búsqueda/triage barato → Haiku.
3. **Dispará todos los carriles a la vez,** no secuencialmente. Ola cloud (hasta
   10 tool calls `Agent` en UN mensaje, mezclando tiers) + cola local en
   paralelo. Se solapan.
4. **Dosificá los subagentes Opus dentro de la ola:** son los más lentos y caros
   del carril cloud y ocupan slots igual que los Sonnet. Máximo 2-3 por ola; el
   resto Sonnet/Haiku. Si una ola es toda-Opus, tu wall-clock es el de Opus.
5. **🚨 GOBERNADOR anti-estampida (regla dura):** hay UN solo Ollama. **Nunca
   permitas más de `OLLAMA_NUM_PARALLEL` (=2) delegaciones locales vivas a la
   vez.** Si 10 agentes cloud delegan al local en simultáneo → cola de 10 =
   desastre. Mitigá: designá qué 1-2 agentes de la ola usan local en cada
   momento; los demás encolan su parte mecánica para la siguiente tanda o —
   solo si hay urgencia real de wall-clock — aplican la excepción Haiku.
   El gobernador es la única válvula que autoriza saltarse el offloading.
6. **`pipeline()` no `parallel()`** en Workflow: sin barrera, el ítem A se
   verifica mientras B implementa. Wall-clock = cadena más lenta, no la suma.
   Fijá `model`/`effort` por etapa (verify en Opus/high, mecánica en Haiku/low).
7. **Pre-scout una vez:** un `explorador` mapea → N `implementadores` reciben
   scope exacto, sin pagar exploración cada uno. Vale doble para los subagentes
   Opus (principio 4).
8. **El offloading no se sacrifica por velocidad.** La vieja regla "para
   velocidad pura, el local es opcional" queda DEROGADA: el local va primero
   siempre que pueda ejecutar la tarea; la presión de wall-clock se maneja con
   el gobernador y la excepción Haiku, no ignorando el carril local.

## Perfil del equipo (validado 2026-07-16 — M3 Pro · 36 GB · 12 cores)

Snapshot medido de ESTA máquina; la fuente de verdad viva es
`~/.claude/capacity.yaml` + `~/local-llm-stack/ARCHITECTURE.md`.

| Recurso | Valor medido | Implicación operativa |
|---|---|---|
| Ejecutor light (mecanico_light) | 2.5 GB disco · **7.4 GB cargado** (medido `/api/ps` 2026-07-26, num_ctx 16384) · tool calling **4/4** | Default: 2 delegaciones concurrentes + QA residente, sin presión de SO |
| Ejecutor heavy (mecanico_heavy, MoE A3B) | 18.6 GB disco · **20 GB cargado** con num_ctx 8192 · 49/49 capas a GPU · tool calling OK | Opt-in. **Se intenta SIEMPRE, aun con RAM presionada** (decisión del usuario, 2026-07-26): el MCP acota el daño con slot exclusivo + descarga del QA + KV reducido, y degrada a light si no entra. El `⚠ heavy vetado` del monitor es un AVISO, no un bloqueo. Costo medido: **+3,8 GB de swap** en una corrida con 3,3 GB de RAM libre |
| **Latencia por delegación** | **~28 s (light), ~18 s (heavy)** — igual en frío y en caliente | Es el número que justifica el umbral de lote. El loop son 2 iteraciones; la carga del modelo NO domina. Delegar tareas de <30 s pierde tiempo |
| QA hooks | 1.9 GB disco · **2.7 GB cargado** · ~5 s por review | Residente junto al light (`OLLAMA_MAX_LOADED_MODELS=2`). No necesita tool calling: devuelve prosa. El tier heavy lo descarga antes de cargar |
| Camino rápido local | light + QA ≈ **10.1 GB residentes** (de 36 GB) | Es el modo de paralelismo seguro; el heavy es la excepción razonada |
| Descartado como ejecutor | `qwen2.5-coder:3b` · tool calling **0/5** | Emite `write_file` como texto y no ejecuta; el loop lo reporta como éxito. Sirve solo de QA |

> **Ojo con las unidades**: Ollama pre-asigna KV al cargar (`NUM_PARALLEL × num_ctx`),
> así que el footprint residente es bastante mayor que el tamaño en disco
> (`qwen3:4b`: 2.5 GB en disco → 5.1 GB cargado). Para presupuestar RAM usá
> **siempre** `/api/ps` (cargado), nunca `/api/tags` (disco).
| Ola cloud | 10 subagentes (12 cores → min(16, 12−2)) | Subagentes Opus ≤ 3 por ola |
| `OLLAMA_NUM_PARALLEL` | 2 | = `local.max_delegaciones_vivas` (gobernador) |
| `num_ctx` ejecutor | 16384 | KV pre-asignado = NUM_PARALLEL × num_ctx; 32768 inflaba el 30B a 28 GB |

Config persistida en `~/Library/LaunchAgents/com.alyp.ollama-env.plist`
(RunAtLoad): `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_NUM_PARALLEL=2`,
`OLLAMA_FLASH_ATTENTION=1`.

## Archivos (debugging)

- MCP: `~/local-llm-stack/devstral-mcp/server.py` (`MODEL_HEAVY`/`MODEL_LIGHT`, `NUM_CTX`, param `tier`)
- Hooks: `~/local-llm-stack/hooks/{qa-review,supervise-devstral}.py` (`QA_MODEL`)
- Env de paralelismo: `~/Library/LaunchAgents/com.alyp.ollama-env.plist`
- Subagentes: `~/.claude/agents/{implementador,explorador,revisor,consultor}.md`
- Arquitectura completa: `~/local-llm-stack/ARCHITECTURE.md`
- **Versiones anteriores**: `versions/v1/` (orquestador Opus, pre-Fable),
  `versions/v2/` (orquestador solo-Fable, 5 niveles), `versions/v2.5/`
  (dual Fable/Opus) y `versions/v2.6/` (dual + capacity.yaml)
