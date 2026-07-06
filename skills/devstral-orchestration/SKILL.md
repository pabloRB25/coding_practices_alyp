---
name: devstral-orchestration
version: 2.5.0
description: >
  Protocolo de orquestación multi-modelo v2.5 de Claude Code para Alyp Studio — dual Fable/Opus. El orquestador (Fable u Opus, auto-detectado) rutea entre 6 roles: orquestador, consultor Fable (escalación por duda del modo Opus, veredicto ⬆ FABLE), subagentes Opus (razonamiento pesado), subagentes Sonnet (implementador/explorador/revisor), ejecutor local en dos tiers (qwen2.5-coder:3b light / qwen3-coder:30b heavy) vía delegate_to_devstral, y QA qwen2.5-coder:3b. Invocar ANTES de orquestar o delegar por primera vez en la sesión, o para interpretar veredictos del hook (✅/⚠/❌/🚨). Versiones anteriores en versions/.
---

# Orquestación multi-modelo v2.5 — Alyp Studio (dual Fable/Opus)

Objetivo: **máxima calidad al menor costo de tokens**. El costo dominante no es
qué modelo trabaja, sino cuánto contexto acumula el orquestador — que en v2.5
es **el modelo del loop principal: Fable u Opus** (ver "¿Quién orquesta?").
Su contexto es el más caro que acumulás en la sesión. Cada lectura/edición/salida se re-envía cada turno.
La regla madre se endurece:

> **Delegá hacia abajo TODO lo delegable y mantené tu contexto de orquestador mínimo:
> leé poco, delegá mucho, recibí resúmenes.** Cada subagente o delegación local
> aísla su propio contexto — solo vuelve el resumen. En v2 hasta el razonamiento
> pesado se delega (a Opus); vos retenés el routing y el veredicto final.

**Qué cambió vs v1**: en v1 el orquestador era Opus y hacía inline todo lo
crítico (seguridad, arquitectura, review final) porque no había nivel superior.
En v2 existe un tier por encima: el análisis profundo baja a subagentes Opus
con contexto aislado, y Fable retiene solo **decisión, síntesis y aprobación**.
Resultado: el contexto más caro acumula aún menos.

**Qué cambió vs v2 (→ v2.5)**: el orquestador ya no es necesariamente Fable —
Fable u Opus pueden serlo (sección "¿Quién orquesta?"). Cuando orquesta Opus,
tiene autoridad plena y un canal de escalación por duda: el agente `consultor`
(`model: "fable"`), que devuelve veredictos `⬆ FABLE` desde contexto aislado.
Spec: `coding_practices_alyp/docs/specs/2026-07-03-orquestacion-v2.5-design.md`.

## ¿Quién orquesta? (leé esto primero)

**Guard de subagentes**: si fuiste despachado como subagente para ejecutar una
tarea específica (implementador, explorador, revisor, consultor o similar), NO
sos el orquestador: ignorá las secciones de orquestación de este skill. Solo te
aplican la cascada local (`delegate_to_devstral` y su gobernador) y el estándar
de evidencia.

**Detección de identidad**: tu system prompt declara qué modelo sos ("You are
powered by …"). Ramificá:

| Sos | Modo | Reglas |
|---|---|---|
| **Fable** | Clásico | Todo este skill tal cual. Sos el techo: no existe escalación para vos; la sección "Modo Opus" no te aplica. |
| **Opus** | Opus | Todo este skill + la sección "Modo Opus": autoridad plena, `consultor` Fable como escalación por duda. |
| **Otro** (Sonnet, Haiku, …) | Degradado | Avisale al usuario UNA vez ("el protocolo asume Fable u Opus como orquestador") y orquestá con las reglas del Modo Opus, pero la consulta al `consultor` es OBLIGATORIA (no por duda) para: seguridad crítica, acciones irreversibles y diseño de arquitectura. El criterio pesado nunca queda en el tier obrero. |

## Los 6 roles

| Nivel | Modelo | Rol |
|---|---|---|
| **Orquestador** | **Fable u Opus (vos, el loop principal)** | Routing, descomposición de planes, síntesis de resultados, resolución de ambigüedad con el usuario, **aprobación final** de seguridad crítica y de merge/prod. Trabajo inline solo cuando delegar cuesta más que hacerlo (cambios de <5 min, decisiones de 1 línea). |
| **Consultor** | **Fable (agente `consultor`, `model: "fable"`)** | Escalación del orquestador en Modo Opus (por duda) o Degradado (obligatoria en crítico): destraba, decide y arbitra UNA consulta puntual desde contexto aislado. Devuelve veredicto `⬆ FABLE`. No aplica cuando orquesta Fable. |
| **Razonador** | **Opus (subagentes, `model: "opus"` en la tool Agent)** | Razonamiento pesado delegado: análisis de seguridad crítica (borrador — vos aprobás), diseño de arquitectura detallado a partir de tu spec, debugging endiablado, juez adversarial de evidencia, review final pre-prod (borrador). |
| **Obrero** | **Sonnet (subagentes, default de los agentes)** | Implementación, research, debugging normal, review no-crítico, verificación en browser |
| **Mecánico** | **Local (`delegate_to_devstral`), por niveles** | Tareas mecánicas, verificables e inequívocas. **`tier="light"` (qwen2.5-coder:3b) = default rápido** (~6 GB con el QA, sin presión de SO); `tier="heavy"` (30B) solo para mecánico-con-razonamiento — pesa ~21 GB, no co-reside cómodo. **Alternativa cloud: `model: "haiku"`** cuando Ollama está apagado/saturado o cuando importa wall-clock (ver scheduler). |
| **QA** | **qwen2.5-coder:3b (hooks)** | Veredicto automático tras Edit/Write y tras cada delegación. Modelo chico → residente junto al ejecutor, sin swap |

Los agentes `implementador`/`explorador`/`revisor` declaran `model: sonnet` en
su frontmatter, pero **el parámetro `model` de la tool Agent lo sobreescribe por
despacho**: el mismo `revisor` despachado con `model: "opus"` es tu revisor de
seguridad; el mismo `explorador` con `model: "haiku"` es un buscador barato.
Un solo set de agentes, tres precios.

## Matriz de routing

> Las filas "Fable (vos)" y "→ Fable aprueba" asumen el modo clásico. **En Modo
> Opus el aprobador sos vos-Opus** (autoridad plena; consultor si dudás) — ver
> "Modo Opus".

| Tarea | Nivel |
|---|---|
| Routing, descomposición del plan en subtareas | **Fable (vos)** |
| Resolución de ambigüedad de requisitos (con el usuario) | **Fable (vos)** |
| **Veredicto final** de seguridad crítica, merge a prod, cambios irreversibles | **Fable (vos)** — podés pedir borrador a Opus, la firma es tuya |
| Síntesis e integración de resultados de subagentes | **Fable (vos)** |
| Análisis de seguridad crítica: auth, JWT/sesión, RLS, secretos, pagos, PII, trust boundaries, middleware de acceso | **Opus** (`revisor` con `model:"opus"`) → Fable aprueba |
| Diseño de arquitectura detallado desde tu spec de alto nivel | **Opus** (`model:"opus"`) → Fable aprueba |
| Debugging difícil (heisenbug, race, cross-system) | **Opus** (`implementador` con `model:"opus"`) |
| Juez adversarial de evidencia / review final pre-prod (borrador) | **Opus** (`revisor` con `model:"opus"`) |
| Implementación de feature multi-archivo con lógica no trivial | **Sonnet** (`implementador`) |
| Research / mapeo del codebase / convenciones | **Sonnet** (`explorador`) |
| Debugging con razonamiento normal | **Sonnet** (`implementador`) |
| Code review de cambios no-críticos | **Sonnet** (`revisor`) |
| Verificación en browser (chrome-devtools) | **Sonnet** (`implementador`) |
| Búsquedas amplias baratas, triage de logs, resúmenes de archivos | **Haiku** (`explorador` con `model:"haiku"`) |
| Tests unitarios, codemods, fixes de tsc/lint mecánicos | **Qwen local** (o Haiku si Ollama saturado) |
| CRUD/feature por template (assets de `alyp-agentic-standards`) | **Qwen local** |
| JSDoc, secciones de README, schemas Zod desde ejemplos | **Qwen local** |
| Boilerplate, scaffolding, refactor mecánico (rename/extract) multi-archivo | **Qwen local** |
| Escalación por duda del orquestador Opus / arbitraje que Opus no cierra | **Consultor Fable** (`consultor`) — solo Modo Opus/Degradado |

## Principios de routing

1. **Al local solo lo verificable + inequívoco.** Una sub-tarea va al ejecutor
   local únicamente si su éxito se comprueba mecánicamente (test pasa, tsc
   limpio, lint limpio) Y el spec no es ambiguo. Mecánico + ambiguo → Sonnet.
2. **Seguridad crítica nunca baja de Opus, y el veredicto nunca baja del
   orquestador.** Un subagente Opus puede analizar auth/RLS/pagos y proponer;
   la aprobación y cualquier cambio irreversible (migración destructiva,
   deploy prod, borrado) los decidís vos, con el usuario cuando corresponda.
   (En Modo Opus el veredicto es tuyo; si dudás, escalá al `consultor` — ver
   "Modo Opus".)
3. **Si dudás del nivel, subí uno.** El costo de un error supera el ahorro.
4. **Opus es caro y lento: despachalo con spec, no con exploración.** Antes de
   un subagente Opus, un `explorador` (Sonnet/Haiku) junta el contexto; Opus
   recibe scope exacto + evidencia y devuelve análisis, no paseos por el repo.
5. **Cascada**: un subagente Sonnet puede a su vez delegar lo mecánico al local.
   El QA y la supervisión corren en el contexto de quien edita, no en el tuyo.
6. **No degrades tu turno a proxy.** Si te descubrís leyendo archivos completos
   o iterando ediciones inline en una tarea delegable, pará y despachá.

## Modo Opus — diferencias vs el modo clásico

Aplica solo si detectaste que sos Opus (o como base del modo Degradado). Son
CUATRO diferencias; todo lo demás del skill rige igual.

1. **El razonador sos vos.** Las filas "Opus" de la matriz podés ejecutarlas
   inline (si tu contexto ya tiene lo necesario) o despachar subagentes Opus
   (si conviene aislar contexto). El resto de la matriz no cambia.
2. **Autoridad plena, escalación por duda.** Decidís todo — incluidos
   seguridad crítica e irreversibles. Consultás al `consultor` SOLO cuando
   dudás. Señales de duda (guía, no gate):
   - 2 intentos fallidos sobre el mismo problema (espejo del ⚠ N/2 local);
   - evidencia contradictoria o insuficiente ante una acción irreversible;
   - conflicto entre veredictos de subagentes;
   - decisión de arquitectura con trade-offs que no lográs cerrar;
   - el `revisor` marcó `🔴 ESCALAR` y tu propio análisis no alcanza.
3. **Disciplina de despacho al consultor (regla dura).** Nunca escales con
   exploración: el paquete lleva scope exacto + evidencia anclada
   (`archivo:línea`, diffs, salidas de comando) + la pregunta decidible + las
   opciones que ya consideraste. Si falta evidencia, primero un `explorador`
   la junta. Una consulta = una pregunta. El consultor es el recurso más caro
   del sistema: desempate, no par de programación.
4. **La cadena sigue siendo de a un nivel.** Tus subagentes no escalan a
   Fable: escalan a vos vía su resumen final, y vos decidís si consultás.

**Prohibido**: consultas headless a Fable vía `claude -p` desde Bash — costo
invisible y sin supervisión. La única vía de escalación es el agente
`consultor`.

## Reglas de descomposición de planes (estándar ralph)

Cuando generes un plan/spec con subtareas (vos en Fable, o vía `writing-plans`),
cada subtarea debe poder correr **desatendida y ser juzgable**. Reglas duras:

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
   cada bloque (Fable / Opus / Sonnet / Haiku / local-light / local-heavy), para
   no decidirlo a ojo en caliente: scaffold/boilerplate → local-light; tests y
   features normales → Sonnet/local; razonamiento difícil, seguridad y el juez →
   Opus; veredicto y síntesis → Fable.

## Despachar subagentes (tool Agent)

- `implementador` — implementa features/cambios siguiendo el estándar Alyp;
  delega lo mecánico al local. Dale plan + alcance + criterio de verificación.
- `explorador` — research read-only; devuelve `archivo:línea`, no volcados.
- `revisor` — review no-crítico; escala lo de seguridad crítica como `🔴 ESCALAR`
  (que en v2 vos re-despachás a un `revisor` con `model:"opus"` y aprobás).
- `consultor` — SOLO en Modo Opus/Degradado: consulta puntual al tier Fable.
  Despachalo con paquete cerrado (scope + evidencia anclada + pregunta
  decidible + opciones consideradas); devuelve `⬆ FABLE — VEREDICTO`.
- **Override de modelo por despacho**: `model: "opus"` para las filas Opus de la
  matriz, `model: "haiku"` para búsquedas/triage baratos, `model: "fable"` es el
  default del `consultor`. Sin override = Sonnet.

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
4. **🚨 ESCALACIÓN** (tope de iteraciones) — tomá el trace y completá la tarea
   con tus herramientas. Nunca dejes algo a medias sin avisar al usuario.

## QA automático en Edit/Write

`qa-review.py` revisa con qwen2.5-coder:3b tras cada edición:
- **QA OK** — continuá.
- **Issues** — críticos (bugs/seguridad) se corrigen antes de seguir; menores se
  notifican y se sigue si no bloquean. El QA chico genera falsos positivos
  (race conditions inexistentes, "faltan tests" en scripts personales): evaluá,
  no apliques a ciegas.
- `[QA local no disponible]` = Ollama apagado o modelo sin descargar; no es error
  de tu trabajo. Avisá una vez y continuá.

## Reglas generales

- Nunca aceptes trabajo delegado (local, Sonnet u Opus) sin su resumen/veredicto.
- Un subagente Opus también rinde cuentas: pedile evidencia anclada
  (`archivo:línea`, test, salida de comando) igual que al `revisor`.
- El nombre `delegate_to_devstral` y los archivos `*devstral*` se conservan por
  compatibilidad (settings/permisos); el modelo ejecutor es Qwen3-Coder.
- RAM (36 GB, **medido**): el camino rápido y robusto es el **tier light** —
  ejecutor `qwen2.5-coder:3b` (~3 GB) + QA 3B (~3 GB) = **~6 GB**, deja el SO al
  74% libre; QA en **~5 s**, dos delegaciones concurrentes (`NUM_PARALLEL=2`).
  El **tier heavy 30B (~21 GB)** cabe en Ollama pero, co-residente con el QA y
  con Claude Code + Chrome + monitor corriendo, **presiona el SO y lo hace
  paginar a disco** (medido: una QA trepó a 167 s vs 5 s). Regla: **default a
  light; usá heavy solo cuando la tarea necesita razonamiento, y asumí que el
  30B no co-reside cómodo con nada más**.

## Optimización de velocidad — scheduler de 2 carriles + mezcla de tiers

Objetivo: **máxima velocidad de ejecución en paralelo en todos los modos**, sin
que un carril ahogue al otro. Cloud y local usan cómputo distinto (infra de
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
2. **Clasificá cada unidad → carril y tier:** razonamiento pesado → Opus;
   ambigua o con lógica → Sonnet; búsqueda/triage barato → Haiku; mecánica +
   verificable + inequívoca → local (`light` default, `heavy` solo con
   razonamiento).
3. **Dispará todos los carriles a la vez,** no secuencialmente. Ola cloud (hasta
   10 tool calls `Agent` en UN mensaje, mezclando tiers) + cola local en
   paralelo. Se solapan.
4. **Dosificá Opus dentro de la ola:** los subagentes Opus son los más lentos y
   caros del carril cloud y ocupan slots igual que los Sonnet. Máximo 2-3 por
   ola; el resto Sonnet/Haiku. Si una ola es toda-Opus, tu wall-clock es el de
   Opus.
5. **🚨 GOBERNADOR anti-estampida (regla dura):** hay UN solo Ollama. **Nunca
   permitas más de `OLLAMA_NUM_PARALLEL` (=2) delegaciones locales vivas a la
   vez.** Si 10 agentes cloud delegan al local en simultáneo → cola de 10 =
   desastre. Mitigá: solo 1-2 agentes designados usan local; el resto hace lo
   mecánico inline o lo mandás a Haiku.
6. **`pipeline()` no `parallel()`** en Workflow: sin barrera, el ítem A se
   verifica mientras B implementa. Wall-clock = cadena más lenta, no la suma.
   Fijá `model`/`effort` por etapa (verify en Opus/high, mecánica en Haiku/low).
7. **Pre-scout una vez:** un `explorador` mapea → N `implementadores` reciben
   scope exacto, sin pagar exploración cada uno. Vale doble para Opus (principio 4).
8. **Para velocidad pura, el local es opcional:** delegar al único Ollama
   serializa; si lo que importa es wall-clock (no ahorro de tokens ni
   privacidad), mandá lo mecánico a Haiku o dejá que el Sonnet lo haga inline,
   y reservá el local para cuando el carril cloud ya está saturado a 10.

### Config de paralelismo (Ollama) — ya aplicada y persistida

| Variable | Valor | Por qué |
|---|---|---|
| `OLLAMA_MAX_LOADED_MODELS` | `2` | ejecutor + QA residentes a la vez |
| `OLLAMA_NUM_PARALLEL` | `2` | 2 requests concurrentes por modelo; >2 infla el KV del 30B y rompe la coexistencia |
| `OLLAMA_FLASH_ATTENTION` | `1` | reduce KV-cache → entran más slots |
| `num_ctx` ejecutor | `16384` | Ollama pre-asigna KV = `NUM_PARALLEL × num_ctx`; 32768 inflaba el 30B a 28 GB |

Persistido en `~/Library/LaunchAgents/com.alyp.ollama-env.plist` (RunAtLoad).

## Archivos (debugging)

- MCP: `~/local-llm-stack/devstral-mcp/server.py` (`MODEL_HEAVY`/`MODEL_LIGHT`, `NUM_CTX`, param `tier`)
- Hooks: `~/local-llm-stack/hooks/{qa-review,supervise-devstral}.py` (`QA_MODEL`)
- Env de paralelismo: `~/Library/LaunchAgents/com.alyp.ollama-env.plist`
- Subagentes: `~/.claude/agents/{implementador,explorador,revisor,consultor}.md`
- Arquitectura completa: `~/local-llm-stack/ARCHITECTURE.md`
- **Versiones anteriores**: `versions/v1/` (orquestador Opus, pre-Fable) y
  `versions/v2/` (orquestador solo-Fable, 5 niveles)
