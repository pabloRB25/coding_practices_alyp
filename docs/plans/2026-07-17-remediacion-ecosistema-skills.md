# Remediación y orquestación del ecosistema de skills — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⛔ **REGLA DURA #0 — este plan NO se ejecuta** (ni en dry-run, ni "solo la primera
> tarea", ni delegado "para adelantar") hasta visto bueno explícito por escrito del
> usuario. La salida de la sesión que lo escribió es ESTE documento y nada más.

**Goal:** Eliminar los conflictos de protocolo, duplicidades y huecos detectados en la auditoría del ecosistema de skills (2026-07-17), e incorporar el estándar de arquitectura (`architecture-standards` + handbook de ingeniería) como contrato genérico que gobierna a cualquier agente en cualquier proyecto.

**Architecture:** Todo cambio es documental (markdown) y vive en `coding_practices_alyp` (fuente de verdad; los symlinks de `~/.claude/skills` y `~/.claude/agents` propagan solos). Se usa el patrón ya existente **contratos → perfiles**: el handbook entra como `contracts/engineering-baseline.md` (línea base genérica), el nuevo `contracts/execution.md` cablea superpowers ↔ agentes Alyp, y los skills/agentes existentes se editan quirúrgicamente para referenciar los contratos en vez de depender de la memoria del orquestador.

**Tech Stack:** Markdown · git (branch + PR a `develop`) · symlinks `~/.claude` · RTK para todo comando.

## Global Constraints

- **Regla #0**: nada de este plan se ejecuta sin visto bueno explícito. La ejecución, cuando se apruebe, tampoco toca plataformas (no deploys, no branch protection): solo archivos + PR.
- Todo comando de lectura/búsqueda/git va con `rtk` (`rtk grep`, `rtk git status`, …).
- Rama de trabajo: `plan/remediacion-ecosistema-skills` desde `develop`. Un commit por tarea (Conventional Commits). Merge únicamente vía PR revisado.
- No romper symlinks existentes: editar los archivos del repo, jamás los symlinks; skills nuevos se agregan con `ln -s` (mismo patrón que los 8 existentes).
- `devstral-orchestration` es protocolo vivo: snapshot a `versions/v2.7.2/` ANTES de editarlo; el editado pasa a v2.8.
- Idioma: dominio/logs/docs en español (convención Alyp).
- Verificación por tarea: estática (grep de contenido nuevo, `ls -la` de symlinks). No hay runtime que probar. Prohibido "verificar" ejecutando flujos de orquestación reales.
- TDD no aplica (solo documentos); la excepción está declarada aquí, conforme al propio skill (`Configuration/docs`).

---

## Mapa de archivos (qué se crea / qué se modifica)

| Archivo | Acción | Ola |
|---|---|---|
| `contracts/engineering-baseline.md` | Crear (desde handbook) | 0 |
| `skills/architecture-standards/SKILL.md` + `references/architecture.md` | Crear + symlink | 0 |
| `contracts/execution.md` | Crear | 0 |
| `contracts/qa-standard.md` | Modificar (evidencia canónica) | 0 |
| `agents/implementador.md` | Modificar | 1 |
| `agents/revisor.md` | Modificar | 1 |
| `agents/consultor.md` | Modificar | 1 |
| `skills/devstral-orchestration/SKILL.md` (→ v2.8) + `versions/v2.7.2/` | Modificar + snapshot | 2 |
| `skills/alyp-agentic-standards/SKILL.md` | Modificar | 3 |
| `skills/alyp-agentic-standards/references/migraciones-datos-vivos.md` | Crear | 3 |
| `skills/alyp-new-project/SKILL.md` | Modificar | 3 |
| `skills/alyp-maestro/SKILL.md` (+ plantilla `especificar`) | Modificar/Crear | 4 |
| `guides/remediacion-legacy.md` | Crear | 4 |
| `~/.claude/CLAUDE.md` (fuera del repo) | Modificar | 5 |
| `~/.claude/projects/-Users-parb-Desktop/memory/no-autoejecutar-planes.md` | Modificar (→ puntero) | 5 |
| Catálogo de plugins/skills duplicados | Desinstalar (con confirmación por ítem) | 5 |
| Skill `architecture-standards` en claude.ai | Actualizar (manual, usuario) | 6 |

Dependencias entre olas: `0 → (1, 2, 3, 4)` · `5` independiente salvo 5.1 · `6` al final. Dentro de cada ola las tareas son independientes entre sí (paralelizables).

---

## OLA 0 — Contratos nuevos (fundación; bloquea a todas las demás)

### Task 0.1: Importar el handbook como `contracts/engineering-baseline.md`

**Files:**
- Create: `contracts/engineering-baseline.md`
- Fuente: `/Users/parb/Downloads/handbook-estandares.html` (v1.0, 2026-07-17)

**Interfaces:**
- Produces: contrato normativo genérico con las 12 secciones (00 cómo usar … 12 fuentes), etiquetas RFC 2119 y los checklists por capa. Toda tarea posterior que diga "baseline" apunta a este archivo con anchors `#NN-<slug>` (ej. `#02-arquitectura`, `#11-definition-of-done`).

- [ ] **Step 1: Convertir HTML → markdown** (mecánico → candidato a ejecutor local tier light). Preservar: numeración de secciones, etiquetas **MUST/SHOULD/MAY** en negrita al inicio de cada regla, los 10 checklists "Checklist — <capa>" como listas `- [ ]`, y la sección Fuentes. Eliminar: markup de UI (contadores "0 de 0", acordeones ▼).
- [ ] **Step 2: Encabezado del contrato.** Añadir al inicio:

```markdown
# Contrato: línea base de ingeniería (engineering-baseline v1)

Línea base **genérica y agnóstica de stack** que todo proyecto y todo agente
debe cumplir. Vocabulario RFC 2119 (MUST/SHOULD/MAY). Los skills `alyp-*` son
**perfiles** de este contrato para next·supabase·vercel — ante conflicto entre
un perfil y este contrato, **el contrato manda**, salvo excepción declarada en
el `standards.yaml` del repo (ver `contracts/manifest.md`, regla 2).

Jerarquía de Definition of Done: los checklists por capa de este contrato son
el **mínimo genérico**; la "definición de done" de `alyp-agentic-standards`
(`pnpm verify` + evidencia reproducible) es su **implementación** en el perfil
next·supabase·vercel. No son dos definiciones: una implementa a la otra.
```

- [ ] **Step 3: Verificar estáticamente.**

Run: `rtk grep -c "MUST" contracts/engineering-baseline.md` → Expected: ≥ 40
Run: `rtk grep -n "^## 02" contracts/engineering-baseline.md` → Expected: 1 match (sección Arquitectura)
Run: `rtk grep -c "Checklist —" contracts/engineering-baseline.md` → Expected: 10

- [ ] **Step 4: Commit** — `feat(contracts): engineering-baseline v1 (línea base genérica RFC 2119)`

### Task 0.2: Crear skill `architecture-standards` en el repo + symlink

**Files:**
- Create: `skills/architecture-standards/SKILL.md`
- Create: `skills/architecture-standards/references/architecture.md`
- Symlink: `~/.claude/skills/architecture-standards → <repo>/skills/architecture-standards`

**Interfaces:**
- Consumes: `contracts/engineering-baseline.md#02-arquitectura` (Task 0.1).
- Produces: skill invocable por cualquier agente local; convención `docs/adr/NNNN-<slug>.md`; formato de ADR que consumen Tasks 3.3, 4.1 y los agentes (Ola 1).

- [ ] **Step 1: Obtener el contenido canónico.** Preferente: el usuario exporta el skill desde claude.ai (Update skill → download) y se usan sus `SKILL.md` + `references/architecture.md` tal cual. Fallback si no hay export: reconstruir desde `engineering-baseline.md#02` + la doctrina ya validada con Rafael (ver Step 2, que es normativo en ambos casos).
- [ ] **Step 2: Asegurar que `SKILL.md` contenga (agregar si el export no lo trae):**

```markdown
---
name: architecture-standards
version: 1.0.0
provides: [architecture-standard]
requires: [engineering-baseline]
description: >
  Doctrina de decisión arquitectónica de Alyp Studio, perfil del contrato
  contracts/engineering-baseline.md §02. Usar en la fase de diseño (desde
  brainstorming) cuando una feature toca estructura: nuevo servicio o worker,
  límite de dominio, contrato público de API, esquema de datos, elección de
  proveedor. También al concebir un proyecto nuevo (decisiones fundacionales)
  y al auditar arquitectura existente. Produce un ADR por decisión.
---

## Reglas núcleo

1. **Monolito modular = hipótesis preferida que se evalúa primero** (por costo
   y simplicidad). Es una **decisión de análisis, no un default automático**:
   si un componente nace legítimamente con forma de servicio (escalado propio,
   equipo autónomo, límite de dominio duro, aislamiento), se separa desde el
   inicio para no pagar una reescritura cara.
2. **Puertas de una vía vs dos vías.** Decisiones reversibles: se toman rápido
   y se registran. Irreversibles (esquema de datos, contrato público, proveedor
   de identidad, separación de servicio): análisis obligatorio + ADR + routing
   al nivel de decisión que corresponda (ver contracts/execution.md).
3. **Todo lo estructural deja ADR** en `docs/adr/NNNN-<slug>.md` (numeración
   incremental, inmutables; una decisión que cambia = ADR nuevo que supersede).
   Formato mínimo: Contexto · Decisión · Alternativas evaluadas · Consecuencias
   · **Reversibilidad** (una vía / dos vías y por qué).
4. El detalle normativo (12-Factor, capas, resiliencia, C4) vive en
   `contracts/engineering-baseline.md#02-arquitectura` — este skill decide,
   el contrato norma.
```

- [ ] **Step 3: Crear el symlink** (mismo patrón que los 8 existentes):

Run: `ln -s /Users/parb/Dev/alyp-studio/coding_practices_alyp/skills/architecture-standards /Users/parb/.claude/skills/architecture-standards`

- [ ] **Step 4: Verificar.**

Run: `ls -la ~/.claude/skills/ | rtk grep architecture` → Expected: symlink → repo
Run: `rtk grep -n "docs/adr" skills/architecture-standards/SKILL.md` → Expected: ≥ 1

- [ ] **Step 5: Commit** — `feat(skills): architecture-standards v1 (doctrina de decisión + ADRs)`

### Task 0.3: Crear `contracts/execution.md` — mapeo superpowers ↔ agentes Alyp

**Files:**
- Create: `contracts/execution.md`

**Interfaces:**
- Produces: tabla de mapeo de roles que consumen los agentes (Ola 1), devstral-orchestration v2.8 (Ola 2) y CLAUDE.md (Ola 5).

- [ ] **Step 1: Escribir el contrato completo:**

```markdown
# Contrato: ejecución de planes (execution v1)

Cablea el proceso de superpowers (subagent-driven-development y afines) con
los roles del protocolo de orquestación (contracts/orchestration.md). El
proceso lo define superpowers; **quién encarna cada rol** lo define esta tabla.
Sobrevive a upgrades del plugin superpowers: ante cambio de templates, la
tabla manda sobre el default genérico.

## Mapeo de roles

| Rol superpowers | Agente Alyp | Modelo | Notas |
|---|---|---|---|
| Implementer subagent | `implementador` | sonnet (default) | template implementer-prompt.md = CONTENIDO del prompt; el agente aporta contexto (RTK, cascada local, estándares) |
| Task reviewer | `revisor` | sonnet | checklist de capa del engineering-baseline según lo tocado |
| Final/broad reviewer | `revisor` | **opus** | pre-merge; seguridad crítica escala, no resuelve |
| Code reviewer (requesting-code-review) | `revisor` | según criticidad | el template code-reviewer.md se pasa como cuerpo |
| Investigación / scouting | `explorador` | sonnet (haiku para triage) | preferido sobre el agente genérico `Explore` en repos Alyp |
| Duda decidible / arbitraje | `consultor` | fable (fijo) | paquete cerrado; veredicto ⬆ FABLE |

## Reglas

1. Al ejecutar un plan con subagent-driven-development en un repo Alyp, los
   despachos usan `subagent_type` de esta tabla. Despachar el genérico
   `general-purpose` para estos roles es violación del protocolo.
2. Carriles por tamaño de trabajo y routing de review: definidos en
   devstral-orchestration (secciones "Carriles" y "Routing de review") —
   este contrato no los duplica.
3. `executing-plans` (sesión separada, checkpoints humanos) solo a pedido
   explícito del usuario; el default con subagentes disponibles es
   subagent-driven-development.
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -n "implementador" contracts/execution.md` → Expected: ≥ 2
- [ ] **Step 3: Commit** — `feat(contracts): execution v1 (mapeo superpowers ↔ agentes Alyp)`

### Task 0.4: Canonicalizar "evidencia" en `contracts/qa-standard.md`

**Files:**
- Modify: `contracts/qa-standard.md` (añadir sección al final)

**Interfaces:**
- Produces: anchor `#definición-canónica-de-evidencia` que referencian Tasks 3.1 y 5.1 (los otros dos textos pasan a puntero).

- [ ] **Step 1: Añadir la sección normativa única:**

```markdown
## Definición canónica de evidencia

Única redacción normativa (las demás menciones en skills/CLAUDE.md son punteros):

Una tarea tiene **evidencia reproducible** cuando cumple lo que aplique:
1. **Lógica**: test co-localizado verde que cubre el happy path del cambio.
2. **Runtime de client** (server actions, hidratación, RLS silencioso):
   verificación en browser real — status 200 en las requests del flujo +
   consola limpia (cero errores) + screenshot; o el `log.warn` de resultado
   vacío disparándose donde corresponde.
3. **Flujo de negocio**: corrida del catálogo con sus TRES oráculos
   (UI + DB + logs por `traceId`) y `veredicto.json` en `qa/evidencias/`.

El transporte de evidencia entre agentes usa `contracts/evidencia.schema.json`.
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -n "Definición canónica de evidencia" contracts/qa-standard.md` → Expected: 1
- [ ] **Step 3: Commit** — `docs(contracts): definición canónica de evidencia en qa-standard`

---

## OLA 1 — Agentes (edits quirúrgicos; depende de Ola 0)

### Task 1.1: `agents/implementador.md` — TDD, debugging, baseline y regla de tests

**Files:**
- Modify: `agents/implementador.md` (sección "## Cómo trabajás", después del bullet del estándar Alyp)

- [ ] **Step 1: Insertar estos bullets (texto exacto):**

```markdown
- **TDD obligatorio** — invocá el skill `superpowers:test-driven-development`:
  test rojo antes de código de producción. Excepción única: el scaffold del
  generador de features es código generado; el ciclo rojo-verde empieza en el
  PRIMER cambio de comportamiento sobre el scaffold (test en `<dominio>.test.ts`
  antes de tocar queries/actions/controller).
- **El test que DEFINE el comportamiento lo escribís VOS** (rojo inicial).
  Al ejecutor local solo van tests mecánicos: cobertura adicional, casos borde
  desde ejemplos, tests de schemas Zod — siempre después del verde.
- **Ante bug o test que falla inesperadamente**: invocá
  `superpowers:systematic-debugging` ANTES de tocar código. Parchear sin
  diagnóstico es violación del protocolo.
- **Línea base de ingeniería** (`contracts/engineering-baseline.md`): no violés
  ningún MUST. Si la tarea te exige desviarte de un SHOULD, no decidas solo:
  devolvé el hallazgo al orquestador (la desviación requiere ADR).
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -c "systematic-debugging\|test-driven-development\|engineering-baseline" agents/implementador.md` → Expected: ≥ 3
- [ ] **Step 3: Verificar symlink intacto.** Run: `ls -la ~/.claude/agents/implementador.md` → Expected: sigue apuntando al repo
- [ ] **Step 4: Commit** — `feat(agents): implementador — TDD/debugging obligatorios + baseline`

### Task 1.2: `agents/revisor.md` — checklists del baseline como instrumento

**Files:**
- Modify: `agents/revisor.md`

- [ ] **Step 1: Insertar en su protocolo de review:**

```markdown
- **Instrumento de auditoría**: usá los checklists por capa de
  `contracts/engineering-baseline.md` según lo que toque el diff (código
  agéntico, arquitectura, DB, APIs, seguridad, auth, nomenclatura, docs,
  calidad). Un MUST incumplido = hallazgo Critical; un SHOULD sin excepción
  declarada (standards.yaml o ADR) = hallazgo Important.
- **Cambios estructurales sin ADR** (`docs/adr/`): hallazgo Important — la
  decisión existe pero no está registrada.
- La evidencia exigible es la de `contracts/qa-standard.md` sección
  "Definición canónica de evidencia".
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -c "engineering-baseline\|docs/adr" agents/revisor.md` → Expected: ≥ 2
- [ ] **Step 3: Commit** — `feat(agents): revisor — checklists engineering-baseline + gate de ADR`

### Task 1.3: `agents/consultor.md` — doctrina para veredictos de arquitectura

**Files:**
- Modify: `agents/consultor.md`

- [ ] **Step 1: Insertar:**

```markdown
- Para consultas de **arquitectura**: tu doctrina es
  `contracts/engineering-baseline.md#02-arquitectura` + el skill
  `architecture-standards` (monolito modular como hipótesis a evaluar primero;
  puertas de una vía exigen análisis explícito). Tu veredicto ⬆ FABLE sobre
  una decisión estructural debe incluir el borrador de ADR (Contexto ·
  Decisión · Alternativas · Consecuencias · Reversibilidad).
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -n "ADR" agents/consultor.md` → Expected: ≥ 1
- [ ] **Step 3: Commit** — `feat(agents): consultor — doctrina de arquitectura + borrador de ADR`

---

## OLA 2 — devstral-orchestration v2.7.2 → v2.8 (depende de Ola 0)

### Task 2.1: Snapshot + edición del protocolo

**Files:**
- Create: `skills/devstral-orchestration/versions/v2.7.2/` (copia íntegra del SKILL.md actual)
- Modify: `skills/devstral-orchestration/SKILL.md` (versión → 2.8.0)

- [ ] **Step 1: Snapshot.** Run: `mkdir -p skills/devstral-orchestration/versions/v2.7.2 && cp skills/devstral-orchestration/SKILL.md skills/devstral-orchestration/versions/v2.7.2/`
- [ ] **Step 2: Bump de versión** en frontmatter (`version: 2.8.0`) y título; añadir al changelog interno del skill: "v2.8: carriles por tamaño, routing de review, precisión de offloading de tests, spec-review por riesgo, referencia a contracts/execution.md".
- [ ] **Step 3: Añadir sección "Carriles por tamaño de trabajo":**

```markdown
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
```

- [ ] **Step 4: Añadir sección "Routing de review":**

```markdown
## Routing de review (tabla única)

| Situación | Mecanismo |
|---|---|
| Review por tarea (subagent-driven) | `revisor` sonnet, con checklist de capa del engineering-baseline |
| Review final pre-merge / seguridad crítica | `revisor` model opus (borrador de veredicto; el orquestador aprueba) + security-review si toca auth/RLS/secretos/dinero |
| Diff chico fuera de un plan | `/code-review` del harness directo |
| Spec que toca auth/RLS/dinero/irreversibles | review adversarial del spec ANTES de writing-plans (`revisor` opus o `consultor`) |
| Feedback recibido | superpowers:receiving-code-review (rigor, no aceptación performativa) |

`requesting-code-review` define CUÁNDO pedir review; esta tabla define QUIÉN.
```

- [ ] **Step 5: Precisar la matriz de offloading** (en la sección del ejecutor local, añadir):

```markdown
**Tests — precisión**: al local van solo tests MECÁNICOS (cobertura adicional,
casos borde desde ejemplos, schemas Zod), siempre después del verde. El test
que DEFINE un comportamiento (rojo inicial de TDD) lo escribe quien implementa
— delegarlo al local es test-after disfrazado y viola el protocolo.
```

- [ ] **Step 6: Referenciar contratos nuevos** — en la sección de subagentes Sonnet añadir: "Mapeo de roles al ejecutar planes superpowers: `contracts/execution.md` (tabla normativa)."
- [ ] **Step 7: Verificar.**

Run: `rtk grep -c "Carriles por tamaño\|Routing de review\|execution.md" skills/devstral-orchestration/SKILL.md` → Expected: ≥ 3
Run: `ls skills/devstral-orchestration/versions/v2.7.2/` → Expected: SKILL.md

- [ ] **Step 8: Commit** — `feat(orchestration): v2.8 — carriles, routing de review, precisión offloading, execution.md`

---

## OLA 3 — Estándares Alyp (depende de Ola 0)

### Task 3.1: `skills/alyp-agentic-standards/SKILL.md` — 4 reconciliaciones

**Files:**
- Modify: `skills/alyp-agentic-standards/SKILL.md`

- [ ] **Step 1: Declarar la excepción TDD del generador** (en FASE 5, tras el párrafo del generador):

```markdown
**TDD y el generador**: el scaffold es código generado (excepción TDD
declarada — no re-negociar por sesión). El ciclo rojo-verde empieza en el
PRIMER cambio de comportamiento sobre el scaffold: test rojo en
`<dominio>.test.ts` antes de tocar queries/actions/controller.
```

- [ ] **Step 2: Declarar jerarquía de DoD** (en "Definición de done", al final):

```markdown
Esta definición IMPLEMENTA, para el perfil next·supabase·vercel, los
checklists de Definition of Done de `contracts/engineering-baseline.md`.
No son dos definiciones: ante duda, el baseline es el mínimo y esto lo concreta.
La redacción canónica de "evidencia" vive en `contracts/qa-standard.md`
("Definición canónica de evidencia") — este texto es un puntero.
```

- [ ] **Step 3: Reconciliar idioma de identificadores** (nueva subsección en FASE 3 o donde viven las convenciones de naming):

```markdown
**Idioma (excepción declarada al baseline §08)**: el baseline pide "un solo
idioma para identificadores". El perfil Alyp lo implementa como regla dual
consciente: **dominio de negocio en español** (features, tablas, códigos de
error, logs — `agenticLogger`, `contexto`, `traceId` como término técnico) y
**vocabulario técnico en inglés** (patrones de archivo: queries/actions/
controller/schema). La frontera es el nombre del dominio: `features/aguinaldos/
aguinaldos.queries.ts`. Declarar esta excepción en el `standards.yaml` de cada
repo (manifest, regla 2).
```

- [ ] **Step 4: Referenciar el baseline** en el encabezado del skill (junto a la mención del contrato code-standard): "Además del contrato propio, este perfil implementa la línea base genérica `contracts/engineering-baseline.md`."
- [ ] **Step 5: Verificar.** Run: `rtk grep -c "engineering-baseline\|excepción TDD\|Idioma" skills/alyp-agentic-standards/SKILL.md` → Expected: ≥ 3
- [ ] **Step 6: Commit** — `feat(standards): TDD-generador, jerarquía DoD, idioma, ref baseline`

### Task 3.2: Crear `references/migraciones-datos-vivos.md`

**Files:**
- Create: `skills/alyp-agentic-standards/references/migraciones-datos-vivos.md`
- Modify: `skills/alyp-agentic-standards/SKILL.md` (una línea de referencia en la fase de migraciones)

- [ ] **Step 1: Escribir la guía (contenido núcleo):**

```markdown
# Migraciones sobre datos vivos (brownfield)

Aplica a todo cambio de esquema en una DB con datos de producción. Complementa
el baseline §03 (migraciones versionadas con rollback). `pnpm verify` NO atrapa
estos errores: la disciplina es de diseño.

## Patrón expand → migrate → contract (obligatorio en breaking changes)

1. **Expand**: agregar lo nuevo sin tocar lo viejo (columna nueva nullable,
   tabla nueva, vista de compatibilidad). Deploy. El código viejo sigue vivo.
2. **Migrate**: backfill por lotes (idempotente, reanudable, con límite de
   filas por lote); doble escritura desde el código nuevo si hay ventana larga.
3. **Contract**: solo cuando NINGÚN código lee lo viejo (verificado, no
   asumido): eliminar columna/tabla vieja en una migración separada y posterior.

## Reglas
- Toda migración destructiva (DROP, tipo incompatible, NOT NULL sobre columna
  poblada) va en su PROPIA migración, nunca mezclada con expand.
- RLS: al crear tabla en expand, sus políticas van en la MISMA migración
  (ventana sin RLS = incidente, no descuido).
- Backward compatibility: entre expand y contract, ambas versiones del código
  deben poder correr contra el mismo esquema (deploys de Vercel conviven).
- Rollback declarado por migración: qué se revierte y qué NO (backfills no se
  des-backfillean: documentar el plan de contingencia en el PR).
- Jamás editar esquema de producción a mano (baseline §03 MUST).
```

- [ ] **Step 2: Referenciar desde el SKILL.md**: "Migraciones sobre DB con datos de producción: seguir `references/migraciones-datos-vivos.md` (expand → migrate → contract)."
- [ ] **Step 3: Verificar.** Run: `rtk grep -n "expand" skills/alyp-agentic-standards/references/migraciones-datos-vivos.md` → Expected: ≥ 3
- [ ] **Step 4: Commit** — `feat(standards): guía de migraciones sobre datos vivos (expand/contract)`

### Task 3.3: `skills/alyp-new-project/SKILL.md` — ADRs fundacionales + frontera con plan-exec

**Files:**
- Modify: `skills/alyp-new-project/SKILL.md` (sección "Decisiones que requieren input del usuario (FASE 1)")

- [ ] **Step 1: Añadir tras la lista de decisiones:**

```markdown
**Las decisiones 2 y 3 (`USE_TURBOREPO`, `USE_MULTITENANCY`) son decisiones de
arquitectura de una vía** (baseline §02, regla de reversibilidad): cada una
produce su ADR fundacional en `docs/adr/` del proyecto nuevo (0001-monorepo,
0002-tenancy), con el formato del skill `architecture-standards`. Si el
proyecto nace con un componente con forma legítima de servicio (escalado
propio, equipo autónomo, límite duro), la separación se decide acá y deja ADR
— no se difiere a una reescritura futura.

**Frontera con `agentic-project-plan-exec-v1`**: ese skill genera la capa de
context-docs para agentes (AGENTS.md/CLAUDE.md/context/); este skill genera la
plataforma (repo+CI+Supabase+Vercel). En un proyecto nuevo Alyp corre PRIMERO
este skill; los context-docs se completan con plan-exec si el cliente los pide.
Ninguno reescribe el output del otro.
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -c "ADR\|plan-exec" skills/alyp-new-project/SKILL.md` → Expected: ≥ 2
- [ ] **Step 3: Commit** — `feat(new-project): ADRs fundacionales + frontera con plan-exec`

---

## OLA 4 — Specs y conocimiento (depende de Ola 0)

### Task 4.1: Skill local fija `especificar` en alyp-maestro

**Files:**
- Modify: `skills/alyp-maestro/SKILL.md` (registrar `especificar` junto a `planificar` como skill fija)
- Create: plantilla de la skill fija (donde alyp-maestro guarde la de `planificar`; replicar el patrón exacto — verificar con `rtk ls skills/alyp-maestro/` al ejecutar)

**Interfaces:**
- Produces: plantilla que maestro instala en `.claude/skills/especificar/SKILL.md` de cada repo cliente.

- [ ] **Step 1: Contenido de la plantilla `especificar`:**

```markdown
---
name: especificar
description: Plantilla de spec de feature de ESTE repo. Usar al cerrar el
  diseño en brainstorming, antes de writing-plans. El spec no está completo
  sin "Mapa al estándar" y "Done verificable".
---

Todo spec de feature incluye, además del diseño:

## Mapa al estándar
- **Dominios afectados**: `features/<X>` nuevos vs modificados.
- **Contratos Zod**: schemas nuevos/cambiados (nombre y campos clave).
- **Migraciones**: SQL + política RLS; si hay datos vivos, clasificar cada
  cambio como expand/migrate/contract (references/migraciones-datos-vivos.md).
- **QA**: flujos a crear/actualizar en `qa/flujos/*.yaml`.
- **ADR**: si toca estructura (servicio, límite de dominio, contrato público,
  esquema, proveedor) → ADR según `architecture-standards`; si no, escribir
  "ADR: no aplica" explícitamente.

## Done verificable
Cada acceptance criterion se expresa en términos del gate y la evidencia
canónica (contracts/qa-standard.md): qué test co-localizado lo cubre, o qué
evidencia de browser/flujo lo demuestra. Un criterio sin forma de verificarse
no entra al spec.

## Routing (recordatorio)
Spec técnico de código → superpowers:brainstorming (HARD-GATE). PRD de
producto → product-management:write-spec. Si existe PRD previo, brainstorming
lo consume como input, no lo reescribe. Spec que toca auth/RLS/dinero/
irreversibles → review adversarial antes de writing-plans.
```

- [ ] **Step 2: Registrar en el SKILL.md de maestro**: mencionar `especificar` en la descripción y donde documenta `planificar` (par de skills fijas: `especificar` alimenta a `planificar`).
- [ ] **Step 3: Verificar.** Run: `rtk grep -rn "especificar" skills/alyp-maestro/ | rtk wc -l` → Expected: ≥ 2
- [ ] **Step 4: Commit** — `feat(maestro): skill fija 'especificar' (Mapa al estándar + done verificable)`

### Task 4.2: Crear `guides/remediacion-legacy.md`

**Files:**
- Create: `guides/remediacion-legacy.md`

**Interfaces:**
- Consumes: `contracts/manifest.md` (regla 3: flujo de auditoría), `contracts/engineering-baseline.md` (checklists como instrumento para repos no-Alyp).

- [ ] **Step 1: Destilar la metodología (validada en nomi_v3, 2026-07-16/17):**

```markdown
# Remediación de estándares en plataforma legacy (modo 3)

Para plataformas existentes que NO cumplen los estándares. Ni greenfield
(alyp-new-project) ni feature normal: primero se decide cuánto estándar
adoptar. Metodología validada en nomi_v3 (2026-07).

## Flujo

1. **Auditar** — repos Alyp: manifest.md regla 3 (standards.yaml → modo audit
   de cada skill en orden de requires → scorecard). Repos no-Alyp: auditar
   contra los checklists por capa de engineering-baseline.md. Output: doc de
   hallazgos en docs/auditorias/AAAA-MM-DD-<tema>.md con veredicto por línea.
2. **Plan de remediación por bloques** — bloques chicos, independientes y
   verificables (un estándar × un área); cada bloque con su verificación
   propia. Regla #0: el plan JAMÁS se autoejecuta (ni dry-run).
3. **Ejecutar por olas** (con visto bueno) — carril normal de ejecución;
   review por bloque. Preferir PRs chicos por bloque sobre un mega-PR.
4. **Sellar** — actualizar standards.yaml + sellos en CLAUDE.md del repo en el
   mismo PR (manifest regla 4).

## Regla boy-scout (para lo NO remediado)

Toda feature nueva sigue el estándar completo; el código existente NO se
reestructura "de paso". Reestructurar es un bloque de remediación explícito
con su propio visto bueno — nunca un efecto colateral de otra tarea.

## Lecciones incorporadas (nomi_v3)

- Harness de ejecución: validación estática solamente antes del visto bueno;
  los args del Workflow se validan con asserts de tipo (bug args-string).
- Placeholders no se asumen: verificar que un archivo "muerto" no tenga
  lógica viva antes de borrarlo (caso employee-file.controller.ts).
- Dual-runtime: clasificar cada módulo (Node/browser) antes de migrar sus
  logs a agenticLogger (caso auditService).
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -c "boy-scout\|manifest" guides/remediacion-legacy.md` → Expected: ≥ 2
- [ ] **Step 3: Commit** — `docs(guides): metodología de remediación legacy (modo 3)`

---

## OLA 5 — CLAUDE.md global, memoria y catálogo (independiente; 5.1 tras Ola 0)

### Task 5.1: `~/.claude/CLAUDE.md` — bloque de routing del ecosistema

**Files:**
- Modify: `~/.claude/CLAUDE.md` (nueva sección tras el bloque de orquestación)

- [ ] **Step 1: Añadir (texto exacto):**

```markdown
## Routing del ecosistema de skills (reglas de una línea)

- Spec técnico de código → `superpowers:brainstorming`; PRD de producto →
  `product-management:write-spec`; PRD previo = input de brainstorming, no se
  reescribe.
- Ejecución de planes: `subagent-driven-development` con el mapeo de roles de
  `contracts/execution.md` (repo coding_practices_alyp). `executing-plans`
  solo a pedido explícito. NO usar el agente `Plan` del harness (writing-plans
  manda). Carriles por tamaño: devstral-orchestration §Carriles.
- Exploración en repos Alyp → agente `explorador` (no `Explore`).
- Review: tabla única en devstral-orchestration §Routing de review.
- `frontend-design` se subordina al design system del repo (tokens/componentes
  documentados en skills locales); solo manda en greenfield sin sistema.
- `verify` en repos Alyp delega en el catálogo `qa/flujos/` (qa-standard).
- Arquitectura: decisiones estructurales → skill `architecture-standards` +
  `contracts/engineering-baseline.md`; toda decisión de una vía deja ADR en
  `docs/adr/`.
- Legacy sin estándar → `guides/remediacion-legacy.md` (auditar antes de tocar).
- Evidencia: definición canónica en `contracts/qa-standard.md` — no re-redactar.
```

- [ ] **Step 2: Verificar.** Run: `rtk grep -c "Routing del ecosistema" ~/.claude/CLAUDE.md` → Expected: 1
- [ ] **Step 3:** (fuera del repo — sin commit; respaldar antes: `cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-2026-07-17`)

### Task 5.2: Desduplicar la Regla #0 + fronteras de memoria

**Files:**
- Modify: `~/.claude/projects/-Users-parb-Desktop/memory/no-autoejecutar-planes.md` (→ puntero)
- Modify: `~/.claude/CLAUDE.md` (añadir tabla de fronteras, dentro de la sección de la Task 5.1)
- Engram: actualizar la observación de la regla para que remita a CLAUDE.md como canónica (via mem_update, en ejecución)

- [ ] **Step 1: Reescribir la memoria file-based como puntero:**

```markdown
---
name: no-autoejecutar-planes
description: "PUNTERO — la redacción canónica de la Regla #0 vive en ~/.claude/CLAUDE.md"
metadata:
  type: feedback
---

Regla #0 (planificar NO es ejecutar): redacción canónica y completa en
`~/.claude/CLAUDE.md`. Este archivo es solo un puntero — no duplicar el texto.
```

- [ ] **Step 2: Añadir a CLAUDE.md la tabla de fronteras:**

```markdown
### Fronteras de memoria (una regla, un lugar)
| Conocimiento | Lugar canónico |
|---|---|
| Reglas duras globales (Regla #0, RTK, routing) | `~/.claude/CLAUDE.md` |
| Hechos episódicos (qué pasó, qué se decidió) | engram |
| Metodología por repo | skills locales vía alyp-maestro |
| Preferencias sueltas del usuario | memoria file-based del harness |
Las demás copias de una regla son punteros, nunca redacciones paralelas.
```

- [ ] **Step 3: Verificar.** Run: `rtk grep -c "PUNTERO" ~/.claude/projects/-Users-parb-Desktop/memory/no-autoejecutar-planes.md` → Expected: 1

### Task 5.3: Purga del catálogo de skills duplicados

**Files:** configuración de plugins/skills (cada ítem requiere confirmación individual del usuario en el momento de ejecutar — listar, preguntar, luego actuar).

- [ ] **Step 1: Presentar la lista al usuario y confirmar ítem por ítem:**

| Duplicado | Se queda | Acción propuesta |
|---|---|---|
| `product-management:brainstorm` vs `product-management:product-brainstorming` | uno (a elección) | desactivar el otro |
| `skill-creator` (plugin) | `superpowers:writing-skills` | desinstalar plugin skill-creator |
| `anthropic-skills:token-optimizer` | `alyp-token-savings` | quitar del catálogo anthropic-skills |
| `anthropic-skills:consolidate-memory` | engram + maestro | quitar |
| `docx` vs `alyp-docx` vs `faciligroup-docx` | `docx` + marcas solo si tienen plantillas propias | consolidar |
| `meeting-minutes` vs `minutas-panda-valentina` | genérica + especializada solo si aporta formato | consolidar |
| `productivity:memory-management` | fronteras de Task 5.2 | desactivar |

- [ ] **Step 2:** Ejecutar solo lo confirmado (comandos `claude plugin remove` / edición del catálogo según corresponda al mecanismo de cada uno).
- [ ] **Step 3: Verificar.** El listado de skills de una sesión nueva ya no muestra los ítems removidos.

---

## OLA 6 — claude.ai (manual, la ejecuta el usuario; al final)

### Task 6.1: Alinear el skill `architecture-standards` de claude.ai con el repo

- [ ] **Step 1 (usuario):** Exportar el skill de claude.ai (si no se hizo en Task 0.2) y reconciliar diferencias con la versión del repo — el repo queda como fuente de verdad.
- [ ] **Step 2 (usuario):** En el skill de claude.ai, reemplazar cualquier contenido de stack específico por un puntero de una línea a los perfiles del repo. **Rechazar la oferta del "stack overlay"** (`references/stack-overlay.md`): duplicaría `alyp-agentic-standards` en claude.ai — segunda fuente de verdad, divergencia garantizada.

### Task 6.2: Endurecer el triggering del skill en claude.ai

- [ ] **Step 1 (usuario):** Correr el loop de optimización de descripción (20 queries reales) **después** de 6.1, para que afine sobre la versión canónica.

---

## Orquestación de la ejecución (cuando haya visto bueno — y solo entonces)

**Sin harness Workflow.** Lección nomi_v3: para ~20 tareas documentales, un harness agrega el riesgo (args-string, ejecución accidental) sin aportar paralelismo que importe. Ejecución = `subagent-driven-development` + la tabla de `contracts/execution.md`... que se crea en la Ola 0 — bootstrap: la Ola 0 la ejecuta el orquestador con `implementador` despachado a mano; de la Ola 1 en adelante ya rige la tabla.

| Ola | Ejecuta | Review | Paralelismo |
|---|---|---|---|
| 0 (contratos) | `implementador` sonnet; conversión HTML→MD (T0.1) al **ejecutor local tier light** | `revisor` sonnet al cierre de ola | T0.1–T0.4 en paralelo (sin dependencias entre sí) |
| 1 (agentes) | `implementador` | `revisor` | T1.1–T1.3 en paralelo |
| 2 (protocolo) | `implementador`; snapshot manual del orquestador ANTES | `revisor` **opus** (protocolo vivo) | secuencial |
| 3 (estándares) | `implementador` | `revisor` | T3.1–T3.3 en paralelo |
| 4 (specs/guías) | `implementador` | `revisor` | T4.1–T4.2 en paralelo |
| 5 (CLAUDE.md/memoria/purga) | orquestador directo (archivos fuera del repo + confirmaciones ítem a ítem) | inspección del usuario | secuencial |
| 6 (claude.ai) | **usuario** (manual) | — | — |

**Gate final:** diff completo de la rama → `revisor` model opus (checklists del propio engineering-baseline recién creado: el plan se audita con su producto) → PR `plan/remediacion-ecosistema-skills` → `develop` → visto bueno del usuario para merge.

**Rollback:** todo vive en la rama hasta el merge; CLAUDE.md global tiene backup (`.bak-2026-07-17`); devstral-orchestration tiene snapshot v2.7.2; la purga de catálogo es reversible reinstalando.

**Riesgos:**
1. *Skill de claude.ai no exportable a tiempo* → Task 0.2 tiene fallback de reconstrucción; la reconciliación queda para Task 6.1.
2. *Editar el protocolo vivo (Ola 2) a mitad de otra sesión de trabajo* → ejecutar la Ola 2 en una sesión sin otro trabajo activo.
3. *Purga rompe un flujo no mapeado* → confirmación ítem por ítem + reversible.
4. *Drift entre este plan y el estado real al momento de ejecutar* → el ejecutor de cada tarea verifica el anchor/sección donde inserta; si el texto de contexto cambió, reporta al orquestador en vez de forzar el edit.

## Fuera de alcance (explícito)

- Ejecutar remediaciones en repos cliente (nomi_v3, faciligroup, …): este plan solo arregla el ecosistema; cada repo se remedia después con `guides/remediacion-legacy.md`.
- Cambios de plataforma (branch protection, secrets, deploys).
- Modificar el plugin superpowers (se cablea por contrato, no se forkea).
