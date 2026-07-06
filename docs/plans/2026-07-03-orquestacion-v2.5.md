# Orquestación v2.5 (dual Fable/Opus) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el skill `devstral-orchestration` a v2.5: Fable u Opus pueden orquestar con el mismo skill (auto-detección de identidad), y Opus escala por duda a un agente nuevo `consultor` (`model: "fable"`).

**Architecture:** Un solo SKILL.md con overlay de modo (sección "¿Quién orquesta?" al inicio + sección compacta "Modo Opus"); un cuarto agente `consultor.md`; la v2 actual se archiva en `versions/v2/`; el bloque de orquestación de `~/.claude/CLAUDE.md` se actualiza. Spec aprobado: `coding_practices_alyp/docs/specs/2026-07-03-orquestacion-v2.5-design.md`.

**Tech Stack:** Solo Markdown (skills y agentes de Claude Code). Sin código, sin tests automatizados — la verificación es por inspección (grep/diff) y smoke test con subagente Opus.

## Global Constraints

- Los archivos destino viven en `~/.claude/` que **NO es repo git** — no hay commits en las tareas 1-4; cada tarea cierra con verificación por comando (`diff`, `grep`, `ls`) en lugar de commit.
- Idioma: todo el contenido en español rioplatense (voseo), consistente con el skill v2 actual.
- No tocar: hooks (`~/local-llm-stack/hooks/`), MCP local (`devstral-mcp/server.py`), config Ollama, agentes existentes (`implementador.md`, `explorador.md`, `revisor.md`).
- El formato del veredicto del consultor es literal e inmutable: encabezado `⬆ FABLE — VEREDICTO` con campos `Decisión / Razones / Condiciones / Confianza`.
- Tarea 5 (smoke test con subagente Opus) la ejecuta el **orquestador**, no un subagente — los subagentes no tienen la tool `Agent`.

---

### Task 1: Archivar v2 en `versions/v2/`

**Files:**
- Create: `~/.claude/skills/devstral-orchestration/versions/v2/` (directorio con copias)

**Interfaces:**
- Produces: snapshot inmutable de la v2 (SKILL.md + 3 agentes + ARCHITECTURE.md) que las tareas siguientes pueden modificar en origen sin pérdida.

- [ ] **Step 1: Crear directorio y copiar archivos de la época v2**

```bash
mkdir -p ~/.claude/skills/devstral-orchestration/versions/v2
cp ~/.claude/skills/devstral-orchestration/SKILL.md ~/.claude/skills/devstral-orchestration/versions/v2/SKILL.md
cp ~/.claude/agents/implementador.md ~/.claude/agents/explorador.md ~/.claude/agents/revisor.md ~/.claude/skills/devstral-orchestration/versions/v2/
cp ~/local-llm-stack/ARCHITECTURE.md ~/.claude/skills/devstral-orchestration/versions/v2/ARCHITECTURE.md
```

- [ ] **Step 2: Verificar el snapshot**

Run: `ls ~/.claude/skills/devstral-orchestration/versions/v2/ && diff ~/.claude/skills/devstral-orchestration/SKILL.md ~/.claude/skills/devstral-orchestration/versions/v2/SKILL.md && echo SNAPSHOT_OK`
Expected: lista con `SKILL.md, implementador.md, explorador.md, revisor.md, ARCHITECTURE.md`; `diff` sin salida; `SNAPSHOT_OK`.

> Nota: `versions/v1/` incluía además un `CLAUDE.md`; para v2 el bloque de CLAUDE.md global se preserva dentro del diff de la Tarea 4, no hace falta copia aparte.

---

### Task 2: Crear el agente `consultor.md`

**Files:**
- Create: `~/.claude/agents/consultor.md`

**Interfaces:**
- Produces: agente `consultor` (frontmatter `model: fable`, `tools: Read, Grep, Glob, Bash`) que la Tarea 3 referencia por nombre en el SKILL.md. Formato de salida `⬆ FABLE — VEREDICTO`.

- [ ] **Step 1: Escribir el archivo completo**

Contenido exacto de `~/.claude/agents/consultor.md`:

```markdown
---
name: consultor
description: Consultor Fable — el tier más alto del sistema, despachado como subagente para destrabar, decidir o arbitrar UNA consulta puntual. Lo despacha un orquestador Opus (escalación por duda) o un orquestador degradado (consulta obligatoria en seguridad crítica, irreversibles y arquitectura). No revisa diffs (eso es del revisor): recibe un paquete cerrado (scope + evidencia + pregunta decidible + opciones consideradas) y devuelve un veredicto accionable con formato fijo ⬆ FABLE.
tools: Read, Grep, Glob, Bash
model: fable
---

Sos el consultor de Alyp Studio: el modelo más capaz del sistema, invocado como
recurso de desempate. Te despacha un orquestador (normalmente Opus) que duda o
se trabó ante una decisión pesada. Tu trabajo es DECIDIR — no explorar el repo,
no implementar, no revisar diffs completos.

## Qué recibís

Un paquete cerrado: contexto mínimo, evidencia anclada (`archivo:línea`, diffs,
salidas de comando), la pregunta concreta y las opciones que el orquestador ya
consideró. Una consulta = una pregunta decidible.

## Cómo trabajás

- Podés verificar la evidencia recibida (Read/Grep/Glob/Bash de solo lectura),
  pero NO amplíes el scope: si la consulta exige explorar terreno nuevo, eso es
  señal de que el paquete vino incompleto — devolvelo, no lo compenses.
- **Estándar de evidencia (regla dura, igual que el revisor)**: sin evidencia
  anclada no hay veredicto positivo. Si la evidencia no alcanza para decidir,
  tu decisión es NO-EVALUABLE + la lista exacta de evidencia faltante
  (artefacto reproducible: test, salida de comando, fixture). No especules.
- No edites nada. Tu texto final ES el veredicto que vuelve al orquestador:
  compacto, accionable, sin ensayos.

## Formato de respuesta (obligatorio, literal)

```
⬆ FABLE — VEREDICTO
Decisión: <qué hacer, en 1-3 líneas>
Razones: <ancladas a la evidencia recibida>
Condiciones: <qué debe cumplirse antes/después, si aplica; "ninguna" si no>
Confianza: alta | media | baja (+ qué evidencia falta si no es alta)
```
```

- [ ] **Step 2: Verificar frontmatter y formato**

Run: `grep -c "model: fable" ~/.claude/agents/consultor.md && grep -c "⬆ FABLE — VEREDICTO" ~/.claude/agents/consultor.md`
Expected: `1` y `1` (o más para el segundo). Ambos > 0.

---

### Task 3: Reescribir SKILL.md a v2.5

**Files:**
- Modify: `~/.claude/skills/devstral-orchestration/SKILL.md`

**Interfaces:**
- Consumes: agente `consultor` (Task 2) — se referencia por nombre exacto `consultor` y por su formato `⬆ FABLE — VEREDICTO`.
- Produces: SKILL.md v2.5 con secciones nuevas "¿Quién orquesta?" y "Modo Opus" que la Tarea 4 (CLAUDE.md) y la Tarea 5 (smoke test) referencian.

Leer el archivo completo primero (`Read`), luego aplicar las ediciones E1-E9 con `Edit` (old_string anclado al texto actual). El frontmatter YAML del archivo (si existe `description:`) se actualiza en E1b.

- [ ] **Step 1 (E1): Título e intro**

Reemplazar:
```
# Orquestación multi-modelo v2 — Alyp Studio
```
por:
```
# Orquestación multi-modelo v2.5 — Alyp Studio (dual Fable/Opus)
```

Y en el párrafo inicial, reemplazar:
```
qué modelo trabaja, sino cuánto contexto acumula el orquestador — y en v2 el
orquestador es **Fable (Mythos-class, por encima de Opus)**: su contexto es el
más caro de todo el sistema.
```
por:
```
qué modelo trabaja, sino cuánto contexto acumula el orquestador — que en v2.5
es **el modelo del loop principal: Fable u Opus** (ver "¿Quién orquesta?").
Su contexto es el más caro que acumulás en la sesión.
```

- [ ] **Step 2 (E1b): Frontmatter description**

Si el archivo tiene frontmatter YAML con `description:`, reemplazar su valor por:
```
Protocolo de orquestación multi-modelo v2.5 de Claude Code para Alyp Studio — dual Fable/Opus. El orquestador (Fable u Opus, auto-detectado) rutea entre 6 roles: orquestador, consultor Fable (escalación por duda del modo Opus, veredicto ⬆ FABLE), subagentes Opus (razonamiento pesado), subagentes Sonnet (implementador/explorador/revisor), ejecutor local en dos tiers (qwen2.5-coder:3b light / qwen3-coder:30b heavy) vía delegate_to_devstral, y QA qwen2.5-coder:3b. Invocar ANTES de orquestar o delegar por primera vez en la sesión, o para interpretar veredictos del hook (✅/⚠/❌/🚨). Versiones anteriores en versions/.
```
Si no tiene frontmatter, omitir este paso.

- [ ] **Step 3 (E2): Insertar sección "¿Quién orquesta?"**

Insertar inmediatamente después del párrafo "**Qué cambió vs v1** …" (y antes de `## Los 5 niveles`) el bloque completo:

```markdown
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
```

- [ ] **Step 4 (E3): Tabla de niveles → 6 roles**

Reemplazar el encabezado `## Los 5 niveles` por `## Los 6 roles`.

En la fila **Orquestador** de la tabla, reemplazar `**Fable (vos, directo)**` por `**Fable u Opus (vos, el loop principal)**`.

Insertar entre la fila **Orquestador** y la fila **Razonador** esta fila nueva:

```
| **Consultor** | **Fable (agente `consultor`, `model: "fable"`)** | Escalación del orquestador en Modo Opus (por duda) o Degradado (obligatoria en crítico): destraba, decide y arbitra UNA consulta puntual desde contexto aislado. Devuelve veredicto `⬆ FABLE`. No aplica cuando orquesta Fable. |
```

- [ ] **Step 5 (E4): Fila nueva en la matriz de routing**

Insertar al final de la tabla "## Matriz de routing":

```
| Escalación por duda del orquestador Opus / arbitraje que Opus no cierra | **Consultor Fable** (`consultor`) — solo Modo Opus/Degradado |
```

- [ ] **Step 6 (E5): Principio de routing 2 — reconciliar veredicto**

Reemplazar:
```
2. **Seguridad crítica nunca baja de Opus, y el veredicto nunca sale de Fable.**
   Un subagente Opus puede analizar auth/RLS/pagos y proponer; la aprobación y
   cualquier cambio irreversible (migración destructiva, deploy prod, borrado)
   los decidís vos, con el usuario cuando corresponda.
```
por:
```
2. **Seguridad crítica nunca baja de Opus, y el veredicto nunca baja del
   orquestador.** Un subagente Opus puede analizar auth/RLS/pagos y proponer;
   la aprobación y cualquier cambio irreversible (migración destructiva,
   deploy prod, borrado) los decidís vos, con el usuario cuando corresponda.
   (En Modo Opus el veredicto es tuyo; si dudás, escalá al `consultor` — ver
   "Modo Opus".)
```

- [ ] **Step 7 (E6): Sección de despacho — agregar consultor y override fable**

En "## Despachar subagentes (tool Agent)", insertar después del bullet de `revisor`:

```markdown
- `consultor` — SOLO en Modo Opus/Degradado: consulta puntual al tier Fable.
  Despachalo con paquete cerrado (scope + evidencia anclada + pregunta
  decidible + opciones consideradas); devuelve `⬆ FABLE — VEREDICTO`.
```

Y reemplazar:
```
- **Override de modelo por despacho**: `model: "opus"` para las filas Opus de la
  matriz, `model: "haiku"` para búsquedas/triage baratos. Sin override = Sonnet.
```
por:
```
- **Override de modelo por despacho**: `model: "opus"` para las filas Opus de la
  matriz, `model: "haiku"` para búsquedas/triage baratos, `model: "fable"` es el
  default del `consultor`. Sin override = Sonnet.
```

- [ ] **Step 8 (E7): Insertar sección "Modo Opus" completa**

Insertar antes de `## Reglas de descomposición de planes (estándar ralph)` el bloque completo:

```markdown
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
```

- [ ] **Step 9 (E8): Sección Archivos — consultor y versions/v2**

Reemplazar:
```
- Subagentes: `~/.claude/agents/{implementador,explorador,revisor}.md`
```
por:
```
- Subagentes: `~/.claude/agents/{implementador,explorador,revisor,consultor}.md`
```

Y reemplazar:
```
- **Versión anterior (v1, orquestador Opus): `versions/v1/`** (SKILL.md, agentes,
  CLAUDE.md y ARCHITECTURE.md de la época)
```
por:
```
- **Versiones anteriores**: `versions/v1/` (orquestador Opus, pre-Fable) y
  `versions/v2/` (orquestador solo-Fable, 5 niveles)
```

- [ ] **Step 10 (E9): Verificación de consistencia interna**

Run: `grep -n "¿Quién orquesta?\|Los 6 roles\|Modo Opus\|consultor\|⬆ FABLE\|versions/v2" ~/.claude/skills/devstral-orchestration/SKILL.md | head -30 && grep -c "Los 5 niveles" ~/.claude/skills/devstral-orchestration/SKILL.md`
Expected: apariciones de todas las secciones/términos nuevos; el conteo final de "Los 5 niveles" = `0` (grep -c sale con código 1, es esperado).

---

### Task 4: Actualizar bloque de orquestación en `~/.claude/CLAUDE.md`

**Files:**
- Modify: `~/.claude/CLAUDE.md` (sección `## Orquestación de modelos (v2 — 5 niveles)`)

**Interfaces:**
- Consumes: nombres exactos de Task 2/3 (`consultor`, "Modo Opus", `⬆ FABLE`).

- [ ] **Step 1: Actualizar encabezado y agregar modo dual**

Reemplazar:
```
## Orquestación de modelos (v2 — 5 niveles)
```
por:
```
## Orquestación de modelos (v2.5 — dual Fable/Opus, 6 roles)
```

Reemplazar:
```
- **Fable (vos, directo)**: routing, descomposición de planes, síntesis, ambigüedad con el usuario, **veredicto final** de seguridad crítica / merge / irreversibles.
```
por:
```
- **Orquestador (vos, el loop principal — Fable u Opus)**: routing, descomposición de planes, síntesis, ambigüedad con el usuario, **veredicto final** de seguridad crítica / merge / irreversibles. Si orquesta Opus: autoridad plena + escalación por duda al `consultor`; si orquesta otro modelo: modo degradado con consulta obligatoria en crítico.
- **Consultor (subagente `consultor`, `model: "fable"`)**: escalación del orquestador Opus — destraba/decide/arbitra una consulta puntual con paquete cerrado (scope + evidencia); devuelve veredicto `⬆ FABLE`.
```

- [ ] **Step 2: Actualizar la línea de agentes**

Reemplazar (dentro del bullet de Sonnet):
```
Agentes: `implementador`, `explorador`, `revisor` (en `~/.claude/agents/`); el mismo agente cambia de tier con el parámetro `model`.
```
por:
```
Agentes: `implementador`, `explorador`, `revisor`, `consultor` (en `~/.claude/agents/`); el mismo agente cambia de tier con el parámetro `model`.
```

- [ ] **Step 3: Verificar**

Run: `grep -n "v2.5\|consultor\|⬆ FABLE" ~/.claude/CLAUDE.md | head -10`
Expected: encabezado v2.5, bullet del consultor y mención `⬆ FABLE` presentes.

---

### Task 5: Verificación — consistencia + smoke test Opus (ejecuta el ORQUESTADOR)

**Files:**
- Ninguno (solo lectura).

**Interfaces:**
- Consumes: SKILL.md v2.5 (Task 3), `consultor.md` (Task 2).

- [ ] **Step 1: Chequeo cruzado de nombres**

Run: `grep -o "consultor" ~/.claude/agents/consultor.md | head -1 && grep -c "consultor" ~/.claude/skills/devstral-orchestration/SKILL.md && grep -c "⬆ FABLE — VEREDICTO" ~/.claude/agents/consultor.md`
Expected: `consultor`, conteo ≥ 4 en SKILL.md, conteo ≥ 1 en consultor.md.

- [ ] **Step 2: Smoke test de la rama Opus (Agent tool, model: "opus")**

El orquestador (no un subagente) despacha un Agent `general-purpose` con `model: "opus"` y este prompt:

```
Leé ~/.claude/skills/devstral-orchestration/SKILL.md completo. Sos un orquestador corriendo en Opus que acaba de cargar ese skill. Respondé en ≤15 líneas: (1) ¿qué modo te corresponde según la sección "¿Quién orquesta?" y por qué? (2) Estás por aplicar una migración destructiva en staging y dos subagentes te dieron veredictos contradictorios — ¿qué hacés, con qué agente y qué formato de respuesta esperás? (3) ¿Podés usar `claude -p` para consultar a Fable? No ejecutes nada más que la lectura del archivo.
```

Expected: (1) Modo Opus por detección de identidad; (2) despacho del agente `consultor` con paquete cerrado, esperando `⬆ FABLE — VEREDICTO`; (3) no — prohibido, la única vía es el `consultor`.

- [ ] **Step 3: Verificación E2E manual (documentar, no ejecutar)**

Queda para el usuario (requiere sesiones nuevas): (a) sesión Fable — cargar el skill y confirmar comportamiento idéntico a v2; (b) sesión `/model opus` — cargar el skill, inducir una duda real y confirmar despacho del `consultor` + veredicto `⬆ FABLE`. Reportar esto como pendiente al cerrar el plan.

---

### Task 6: Commit del plan y cierre en `coding_practices_alyp`

**Files:**
- Ya creado: `docs/plans/2026-07-03-orquestacion-v2.5.md` (este archivo)

- [ ] **Step 1: Commit**

```bash
cd ~/Dev/alyp-studio/coding_practices_alyp
git add docs/plans/2026-07-03-orquestacion-v2.5.md
git commit -m "docs(plan): implementación orquestación v2.5 — dual Fable/Opus

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Verificar**

Run: `git -C ~/Dev/alyp-studio/coding_practices_alyp log --oneline -1`
Expected: el commit del plan.
