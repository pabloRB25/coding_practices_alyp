---
name: devstral-orchestration
description: >
  Protocolo de orquestación multi-modelo de Claude Code para Alyp Studio.
  Define el routing entre 4 niveles: Opus (vos, directo) para planes,
  arquitectura, seguridad crítica y review final; subagentes Sonnet
  (implementador/explorador/revisor) para implementación, research y review
  no-crítico; ejecutor local en dos tiers (qwen2.5-coder:3b light /
  qwen3-coder:30b heavy) vía delegate_to_devstral; qwen2.5-coder:3b para QA. Invocar ANTES de
  orquestar o delegar por primera vez en la sesión, o cuando haya que
  interpretar un veredicto del hook (✅/⚠/❌/🚨).
---

# Orquestación multi-modelo — Alyp Studio

Objetivo: **máxima calidad al menor costo de tokens**. El costo dominante no es
qué modelo trabaja, sino cuánto contexto acumula el orquestador (Opus). Cada
lectura/edición/salida se re-envía cada turno. Por eso la regla madre es:

> **Delegá hacia abajo y mantené tu contexto (Opus) mínimo: leé poco, delegá
> mucho, recibí resúmenes.** Cada subagente o delegación local aísla su propio
> contexto — solo vuelve el resumen.

## Los 4 niveles

| Nivel | Modelo | Rol |
|---|---|---|
| **Arquitecto** | **Opus (vos, directo)** | Planes/specs, arquitectura, seguridad crítica, review final pre-prod, routing, resolución de ambigüedad |
| **Obrero** | **Sonnet (subagentes)** | Implementación, research, debugging, review no-crítico, verificación en browser |
| **Mecánico** | **Local (`delegate_to_devstral`), por niveles** | Tareas mecánicas, verificables e inequívocas. **`tier="light"` (qwen2.5-coder:3b) = default rápido** (trivial inequívoco, ~6 GB con el QA, sin presión de SO); `tier="heavy"` (30B) solo para mecánico-con-razonamiento — pesa ~21 GB, no co-reside cómodo |
| **QA** | **qwen2.5-coder:3b (hooks)** | Veredicto automático tras Edit/Write y tras cada delegación. Modelo chico → **residente junto al ejecutor, sin swap** |

## Matriz de routing

| Tarea | Nivel |
|---|---|
| Plan/spec, decisión de arquitectura | **Opus (vos)** |
| Seguridad crítica: auth, JWT/sesión, RLS, secretos, pagos, PII, validación en trust boundaries, middleware de acceso | **Opus (vos)** |
| Review final antes de merge/prod, ambigüedad de requisitos | **Opus (vos)** |
| Implementación de feature multi-archivo con lógica no trivial | **Sonnet** (`implementador`) |
| Research / mapeo del codebase / convenciones | **Sonnet** (`explorador`) |
| Debugging con razonamiento (no arquitectónico) | **Sonnet** (`implementador`) |
| Code review de cambios no-críticos | **Sonnet** (`revisor`) |
| Verificación en browser (chrome-devtools) | **Sonnet** (`implementador`) |
| Tests unitarios, codemods, fixes de tsc/lint mecánicos | **Qwen local** |
| CRUD/feature por template (assets de `alyp-agentic-standards`) | **Qwen local** |
| JSDoc, secciones de README, schemas Zod desde ejemplos | **Qwen local** |
| Boilerplate, scaffolding, refactor mecánico (rename/extract) multi-archivo | **Qwen local** |

## Principios de routing

1. **Al local solo lo verificable + inequívoco.** Una sub-tarea va al ejecutor
   local únicamente si su éxito se comprueba mecánicamente (test pasa, tsc
   limpio, lint limpio) Y el spec no es ambiguo. Mecánico + ambiguo → Sonnet.
2. **Nunca delegues** (ni a Sonnet ni a local) seguridad crítica, secretos,
   infraestructura, o cambios irreversibles. Eso es Opus.
3. **Si dudás del nivel, subí uno.** El costo de un error supera el ahorro.
4. **Cascada**: un subagente Sonnet puede a su vez delegar lo mecánico al local.
   El QA y la supervisión corren en el contexto de quien edita, no en el tuyo.

## Reglas de descomposición de planes (estándar ralph)

Cuando generes un plan/spec con subtareas (vos en Opus, o vía `writing-plans`),
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
4. **Esfuerzo declarado por bloque.** Anotá qué nivel del routing de arriba
   (Opus / Sonnet / local-light / local-heavy) corresponde a cada bloque, para no
   decidirlo a ojo en caliente: scaffold/boilerplate → local-light; tests y
   features de complejidad normal → Sonnet/local; razonamiento difícil, seguridad
   y el juez → Opus.

## Despachar subagentes Sonnet (tool Agent)

- `implementador` — implementa features/cambios siguiendo el estándar Alyp;
  delega lo mecánico al local. Dale plan + alcance + criterio de verificación.
- `explorador` — research read-only; devuelve `archivo:línea`, no volcados.
- `revisor` — review no-crítico; escala lo de seguridad crítica como `🔴 ESCALAR`.

Despachá varios en paralelo (un solo mensaje con varias tool calls) cuando las
tareas son independientes. Cada agente devuelve un resumen; vos integrás y
decidís. Para fan-out grande con verificación adversarial, considerá Workflow.

## Después de cada delegación local

El hook `supervise-devstral.py` emite un veredicto. Seguí:

1. **✅ APROBADO** — continuá.
2. **⚠ REINTENTO N/2** — re-delegá con el `delegate_to_devstral()` exacto que
   indica el hook (no edites el prefijo `CORRECCIÓN (intento N/M):`, el contador
   depende de él). Dale al local la oportunidad de autocorregirse.
3. **❌ No resuelto en 2 intentos** — no re-delegues; corregí con Edit/Write/Bash
   (o pasale a un `implementador` Sonnet). Verificá que tsc/tests pasen.
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

- Nunca aceptes trabajo delegado (local o Sonnet) sin su resumen/veredicto.
- El nombre `delegate_to_devstral` y los archivos `*devstral*` se conservan por
  compatibilidad (settings/permisos); el modelo ejecutor es Qwen3-Coder.
- RAM (36 GB, **medido**): el camino rápido y robusto es el **tier light** —
  ejecutor `qwen2.5-coder:3b` (~3 GB) + QA 3B (~3 GB) = **~6 GB**, deja el SO al
  74% libre; QA en **~5 s**, dos delegaciones concurrentes (`NUM_PARALLEL=2`).
  El **tier heavy 30B (~21 GB)** cabe en Ollama pero, co-residente con el QA y
  con Claude Code + Chrome + monitor corriendo, **presiona el SO y lo hace
  paginar a disco** (medido: una QA trepó a 167 s vs 5 s). Regla: **default a
  light; usá heavy solo cuando la tarea necesita razonamiento, y asumí que el
  30B no co-reside cómodo con nada más**. El thrash viejo (QA de 13 GB que
  expulsaba al ejecutor) quedó eliminado de raíz al bajar el QA a 3 GB.

## Optimización de velocidad — scheduler de 2 carriles

Objetivo: **máxima velocidad de ejecución en paralelo en todos los modos**, sin
que un carril ahogue al otro. Cloud y local usan cómputo distinto (infra de
Anthropic vs tu RAM) → **se solapan gratis**; el truco es saturar ambos a la vez.

```
Wall-clock ≈ profundidad_camino_crítico × latencia_etapa
Paralelismo_max = W_cloud + W_local   (si la descomposición da esa cantidad de unidades independientes)
  W_cloud = min(10, unidades_independientes)   ← Sonnet, cap min(16, cores−2); en esta Mac (12c) = 10
  W_local = OLLAMA_NUM_PARALLEL = 2            ← un modelo residente atiende 2 requests concurrentes
```

**El cuello real es la descomposición, no el hardware** (Sonnet corre en cloud,
no en tus cores). Maximizá unidades independientes y el resto se acomoda.

### Reglas del scheduler

1. **Descomponé al grano más fino independiente** (por archivo / módulo de test /
   dimensión de review). Ese es el techo del paralelismo.
2. **Clasificá cada unidad → carril:** ambigua o con lógica → Sonnet; mecánica +
   verificable + inequívoca → local. Dentro de local: trivial → `tier="light"`,
   mecánico-con-razonamiento → `tier="heavy"`.
3. **Dispará los dos carriles a la vez,** no secuencialmente. Ola Sonnet (hasta
   10 tool calls `Agent` en UN mensaje) + cola local en paralelo. Se solapan.
4. **🚨 GOBERNADOR anti-estampida (regla dura):** hay UN solo Ollama. **Nunca
   permitas más de `OLLAMA_NUM_PARALLEL` (=2) delegaciones locales vivas a la
   vez.** Si 10 agentes Sonnet delegan al local en simultáneo → cola de 10 =
   desastre. Mitigá: solo 1-2 agentes designados usan local, o el resto hace lo
   mecánico inline durante la ola.
5. **`pipeline()` no `parallel()`** en Workflow: sin barrera, el ítem A se
   verifica mientras B implementa. Wall-clock = cadena más lenta, no la suma.
6. **Pre-scout una vez:** un `explorador` mapea → N `implementadores` reciben
   scope exacto, sin pagar exploración cada uno.
7. **Para velocidad pura, el local es opcional:** delegar al único Ollama
   serializa; si lo que importa es wall-clock (no ahorro de tokens), dejá que el
   Sonnet haga lo mecánico inline y reservá el local para cuando el carril cloud
   ya está saturado a 10.

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
- Subagentes: `~/.claude/agents/{implementador,explorador,revisor}.md`
- Arquitectura completa: `~/local-llm-stack/ARCHITECTURE.md`
