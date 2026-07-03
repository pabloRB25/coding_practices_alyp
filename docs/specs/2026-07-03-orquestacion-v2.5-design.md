# Orquestación multi-modelo v2.5 — Dual Fable/Opus con consultor

**Fecha**: 2026-07-03 · **Estado**: diseño aprobado · **Alcance**: skill global `devstral-orchestration` + agentes de `~/.claude/agents/`

## Problema

En v2 el protocolo asume que el orquestador (loop principal de la sesión) es
siempre Fable. Si la sesión corre en Opus —por costo, disponibilidad o
preferencia— el protocolo no aplica limpio: Opus no sabe qué reglas seguir ni
tiene canal para pedir soporte a un tier superior cuando se traba.

Se necesita que **Fable u Opus puedan orquestar con el mismo skill**, y que
Opus pueda **escalar a Fable como soporte** cuando lo necesite.

## Insight habilitante

El harness no permite llamadas "hacia arriba" (un subagente jamás invoca al
orquestador), pero la tool `Agent` acepta `model: "fable"` como override. La
escalación se modela entonces como **despacho hacia abajo a un consultor más
inteligente con contexto aislado**: Opus empaqueta el problema + evidencia, lo
manda a un subagente Fable, y recibe un veredicto. Estructuralmente idéntico a
lo que hoy hace Fable con Opus, invertido. Beneficio adicional: en modo Opus,
el contexto de Fable (el más caro del sistema) aparece solo en consultas
puntuales y cortas, no acumulando la sesión entera.

## Decisiones tomadas (con el usuario, 2026-07-03)

| Decisión | Elección |
|---|---|
| Gate de seguridad/irreversibles en modo Opus | **Opus decide con autoridad plena; consulta a Fable solo si duda** (no hay gate duro) |
| Materialización del consultor | **Agente nuevo `consultor.md`** (no reusar `revisor`) |
| Sesión en modelo ≠ Fable/Opus | **Avisar y orquestar degradado**: modo Opus + consulta obligatoria a Fable en seguridad crítica, irreversibles y arquitectura |
| Estructura del contenido dual-modo | **Un solo SKILL.md con overlay de modo** (sección de diferencias compacta, sin fragmentar) |

## Diseño

### 1. Sección "¿Quién orquesta?" (inicio del SKILL.md)

Dos piezas, en este orden:

1. **Guard de subagentes**: si el lector fue despachado como subagente para una
   tarea específica, ignora las secciones de orquestación; solo le aplican las
   reglas de cascada local y evidencia. Evita que un `implementador` (que tiene
   la tool `Skill`) se crea orquestador por cargar el protocolo.
2. **Detección de identidad**: el orquestador lee su modelo del system prompt
   ("You are powered by …") y ramifica:
   - **Fable** → modo v2 clásico, sin cambios. Es el techo: no hay escalación.
   - **Opus** → modo Opus (sección 3).
   - **Otro modelo** (Sonnet, Haiku, …) → modo degradado: avisa al usuario una
     vez ("el protocolo asume Fable u Opus como orquestador") y orquesta con
     las reglas del modo Opus **pero con consulta obligatoria al `consultor`**
     para seguridad crítica, acciones irreversibles y diseño de arquitectura.
     El criterio pesado nunca queda en el tier obrero.

### 2. Sexto rol: agente `consultor` (nuevo)

Archivo: `~/.claude/agents/consultor.md`.

- **Frontmatter**: `model: fable` · `tools: Read, Grep, Glob, Bash` (read-only
  + verificación de evidencia por comandos; no edita).
- **Mandato**: no revisa diffs (eso es del `revisor`) — **destraba, decide y
  arbitra una consulta puntual**. Recibe un paquete cerrado y devuelve un
  veredicto accionable, no un ensayo ni exploración.
- **Estándar de evidencia**: el mismo del `revisor` — sin evidencia anclada,
  el resultado es NO-EVALUABLE, nunca positivo.
- **Formato de respuesta fijo**:

```
⬆ FABLE — VEREDICTO
Decisión: <qué hacer, en 1-3 líneas>
Razones: <ancladas a la evidencia recibida>
Condiciones: <qué debe cumplirse antes/después, si aplica>
Confianza: alta | media | baja (+ qué evidencia falta si no es alta)
```

### 3. Modo Opus — únicas diferencias vs el modo Fable

1. **Razonamiento pesado inline o delegado, a criterio**: Opus *es* el
   razonador. Las filas "Opus" de la matriz de routing puede ejecutarlas él
   mismo (si el tamaño del contexto lo justifica) o despachar subagentes Opus
   (si conviene aislar contexto). El resto de la matriz no cambia.
2. **Autoridad plena con escalación por duda**: Opus decide todo, incluidos
   seguridad crítica e irreversibles. Consulta al `consultor` **solo cuando
   duda**. Señales de duda operacionalizadas (guía, no gate):
   - 2 intentos fallidos sobre el mismo problema (espejo del ⚠ N/2 local);
   - evidencia contradictoria o insuficiente ante una acción irreversible;
   - conflicto entre veredictos de subagentes;
   - decisión de arquitectura con trade-offs que no logra cerrar;
   - el `revisor` marcó `🔴 ESCALAR` y el análisis propio no alcanza.
3. **Disciplina de despacho al consultor (regla dura)**: nunca escalar con
   exploración. El paquete lleva scope exacto + evidencia anclada
   (`archivo:línea`, diffs, salidas de comando); si falta evidencia, primero
   un `explorador` la junta. Una consulta = una pregunta decidible. El
   consultor es el recurso más caro del sistema: desempate, no par de
   programación.
4. **La cadena sigue siendo de a un nivel**: los subagentes no escalan a Fable
   directo; escalan a Opus vía su resumen final, y Opus decide si consulta.

Fuera del protocolo (documentado como NO-hacer): consultas headless a Fable
vía `claude -p --model claude-fable-5` desde Bash — costo invisible y sin
supervisión.

### 4. Cambios materiales

| Archivo | Cambio |
|---|---|
| `~/.claude/skills/devstral-orchestration/SKILL.md` | Reescritura v2.5: sección "¿Quién orquesta?" + `consultor` en niveles/matriz/sección de despacho + sección "Modo Opus". Frontmatter: description menciona ambos modos y la escalación. |
| `~/.claude/skills/devstral-orchestration/versions/v2/` | Archivar la v2 actual (SKILL.md + copias de agentes de la época), mismo patrón que `versions/v1/`. |
| `~/.claude/agents/consultor.md` | Nuevo agente (sección 2). |
| `~/.claude/CLAUDE.md` | Actualizar bloque "Orquestación de modelos" a "(v2.5 — dual Fable/Opus)": 2-3 líneas sobre el modo Opus y el consultor. |
| `coding_practices_alyp/docs/specs/` | Este documento (commiteado). |

**Sin cambios**: hooks (`qa-review.py`, `supervise-devstral.py`), MCP local
(`devstral-mcp/server.py`), config de Ollama, agentes existentes
(`implementador`, `explorador`, `revisor`).

### 5. Verificación

Prueba real en dos sesiones:

1. **Sesión Fable**: cargar el skill; el comportamiento debe ser idéntico a v2
   (detecta Fable → modo clásico, nunca menciona escalación propia).
2. **Sesión `/model opus`**: cargar el skill; debe auto-detectarse como Opus,
   y ante un caso de duda inducido (p.ej. decisión de arquitectura con
   trade-offs abiertos) despachar al `consultor` con `model: "fable"` y
   recibir/aplicar el veredicto `⬆ FABLE`.

Evidencia: transcripciones de ambas sesiones.

## Fuera de alcance (YAGNI)

- Presupuesto/límite duro de consultas al consultor por sesión (queda como
  disciplina, no como regla contable).
- Modo "Fable consulta a Fable" o segundas opiniones del consultor en modo
  Fable.
- Cambios al stack local (tiers qwen, hooks, Ollama).
- Sincronizar el mirror de skills en `coding_practices_alyp/skills/` (se hará
  cuando se actualice ese ecosistema en conjunto).
