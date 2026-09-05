---
name: alyp-maestro
version: 1.1.0
provides: [curaduria]
description: >
  Curador del conocimiento LOCAL de un proyecto Alyp. Tras cerrar una feature o
  tarea, destila lo aprendido en skills locales versionadas en el repo del
  cliente (.claude/skills/<nombre>/SKILL.md): metodologías, pitfalls y decisiones
  durables que Claude auto-carga en futuras sesiones de ESE proyecto. Complementa
  engram (recall de hechos) — no lo duplica. Incluye el par de skills fijas
  `especificar` (spec de feature) y `planificar` (troceo del plan) —
  `especificar` alimenta a `planificar`.
  Invocar al terminar una feature/tarea, antes de dar por cerrado el trabajo, o
  cuando el usuario pida "curar el conocimiento del proyecto" / "qué aprendimos".
---

# Alyp Maestro — curador de conocimiento local del proyecto

Destila, a partir de lo que aprendió una tarea, un conjunto de **skills locales
del proyecto** que reduzcan el groping de futuras iteraciones —al **planificar**
y al **ejecutar**— y eviten repetir los mismos errores.

**No implementa código de producto** ni verifica evidencia de un bloque (eso es
el `revisor`/juez). Su único output son las skills locales bajo `.claude/skills/`
del repo del cliente.

## Maestro vs engram (la frontera — leé esto primero)

Tenés dos memorias y NO son lo mismo. Antes de escribir nada, decidí cuál corresponde:

| | engram + `MEMORY.md` | skills locales (maestro) |
|---|---|---|
| **Qué guarda** | *Hechos* puntuales: qué pasó, qué se decidió, qué bug se arregló | *Metodología consumible*: cómo se hace X en ESTE repo |
| **Cómo se consume** | Recall: vos buscás con `mem_search` cuando sospechás que hay contexto | Auto-carga: Claude lee la skill al abrir el proyecto, sin buscar |
| **Dónde vive** | Base de engram (global, por proyecto) | En el repo del cliente, versionado en git, viaja con el código |
| **Forma** | Observación en prosa | `SKILL.md` accionable, una preocupación por archivo |

Regla: si es "**cómo** levantar el entorno / correr los tests / trocear el trabajo
en este proyecto" (durable, consumible, repetible) → **skill local**. Si es "**qué**
pasó / qué se decidió puntualmente en esta sesión" → **engram**. Ante la duda,
una decisión de arquitectura va a ambos: el hecho a engram, el "cómo respetarla de
acá en adelante" a una skill local.

## Dónde viven las skills locales

En **`.claude/skills/<nombre>/SKILL.md`** en la raíz del repo del cliente (no en
`~/.claude`, no en engram). Así Claude Code las auto-descubre **solo dentro de ese
proyecto** y viajan con el repositorio. Cada una es un archivo:

```markdown
---
name: <nombre-en-kebab-case>
description: <una línea — para qué sirve y cuándo consultarla>
metadata:
  tipo: metodologia | pitfall | decision
---

<el conocimiento reutilizable, conciso y accionable, UNA sola preocupación por
archivo: la metodología a seguir, el pitfall a evitar (con su síntoma observable),
o la decisión local tomada y su porqué.>
```

Tres tipos, y nada más:

- **metodologia** — la forma no obvia de hacer algo en este proyecto que costó
  varios intentos a ciegas descubrir (cómo se levanta el entorno, el orden correcto
  de un proceso, cómo se corren los tests de un módulo).
- **pitfall** — una trampa que se pisó (idealmente más de una vez), descrita con su
  **síntoma observable** y cómo evitarla. Ej.: "RLS devuelve 0 filas sin lanzar
  error → revisar membership antes de asumir bug de query".
- **decision** — una decisión local (librería elegida, arquitectura, convención,
  restricción) que futuras iteraciones deben respetar o malgastarán tiempo
  redescubriéndola.

## La skill fija `especificar`

`especificar` es, junto con `planificar`, una skill local con nombre fijo y
consumidor fijo: la usa quien cierra el diseño de una feature en
`superpowers:brainstorming`, **antes** de pasar a `writing-plans`. Fija la
plantilla de spec de ESTE repo — el spec no está completo sin "Mapa al
estándar" y "Done verificable". El maestro instala y mantiene viva esta
plantilla en `.claude/skills/especificar/SKILL.md` de cada repo cliente:

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
  cambio como expand/migrate/contract según `alyp-agentic-standards`.
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

## La skill fija `planificar`

`planificar` es la contraparte de `especificar` en el par de skills fijas de
este proyecto: la usa quien descompone el trabajo en este repo (vos en Opus, o
`writing-plans`) **antes** de generar subtareas, y consume el spec que dejó
`especificar` (con su "Mapa al estándar" y "Done verificable" ya resueltos).
Recoge la metodología de planificación de ESTE proyecto: cómo trocear, qué
granularidad funciona, qué prerrequisitos respetar, qué orden. El maestro la
crea y la mantiene viva con lo aprendido, como cualquier otra skill local.

El maestro instala esta plantilla en `.claude/skills/planificar/SKILL.md` de cada
repo cliente. Lo de abajo es el **piso** —doctrina del ecosistema, igual en todos
los repos—; encima el maestro acumula lo propio de ESTE repo: la granularidad que
funcionó, los prerrequisitos, el orden.

```markdown
---
name: planificar
description: Metodología de troceo de ESTE repo. Usar al descomponer un spec en
  tareas, después de `especificar` y antes de emitir contratos (alyp-exec F0).
---

## La unidad

Una tarea es una **rebanada vertical de comportamiento observable** que cabe en
un ciclo rojo→verde→refactor, con **un oráculo propio**, un **Boundary cerrado**
y un commit revisable. Si le falta uno de los cuatro no es una tarea: es una
épica (partir) o un paso interno (fusionar).

> **La granularidad óptima es la tarea más grande que todavía cabe en un solo
> ciclo verificable.** Más grande, se pierde el criterio de "hecho". Más chica,
> pagás re-ingesta de contexto sin ganar verificación.

Y el corolario que casi todos se saltan: **descomponer sin gate entre tareas es
peor que no descomponer** — un fallo a mitad de una lista plana re-ejecuta todo
lo que viene después.

## Esquema de tarea

Los campos existen para traducirse mecánicamente al Contrato de Tarea:

    ## T-XX · <verbo> <comportamiento observable>
    Boundary:  archivos que puede tocar (lista cerrada, salida de alyp-graph)
    Depends:   T-YY, T-ZZ
    Produces:  firmas / tipos / schema exactos que otras tareas consumen
    Consumes:  lo que toma de tareas previas, con firma exacta
    Oráculo:   test | contrato | postcondicion | browser | eval | estructural
    Rojo:      3-7 asserts observables, literales

| Campo del plan | Campo del contrato (alyp-exec) |
|---|---|
| `Boundary` | `archivos:` |
| `Produces` / `Consumes` | `contratos:` (pegados, no referenciados) |
| `Oráculo` | `oraculo:` |
| `Rojo` | `verificacion:` + `rojo_esperado:` |
| `Depends` | orden de olas — misma ola exige archivos disjuntos |

**`Produces` reemplaza las "notas" que una tarea le deja a la siguiente.** Lo que
cruza el borde entre tareas tiene que ser contrato tipado que el typecheck valida.
Prosa escrita por un agente es un canal sin verificación: propaga errores aguas
abajo sin que nada los frene.

## MUST

- **Nombrar el oráculo antes de escribir el rojo.** La tabla por tipo de trabajo
  vive en `alyp-exec/references/contrato-tarea.md` — no la repitas acá.
- **El rojo lo escribe quien planifica, nunca quien implementa.** Si el mismo
  contexto produce criterio e implementación, el criterio se adapta al código.
- **El rojo se demuestra fallando antes de tocar producción** (G1↓), y falla por
  el objetivo ausente, no por un import roto.
- **Rebanada vertical**: cada tarea deja software que funciona por sí solo.
- Un comportamiento por assert · una tarea por contexto · un commit por tarea.
- **`Boundary` sale del grafo** (`alyp-graph`), no de la memoria.
- Gate por tarea (G1/G2) y **gate de ola** (G3) antes de la siguiente.
- Ante fallo, **clasificar la causa antes de reintentar** —contrato ambiguo,
  ejecución, o entorno— y reintentar **solo** la tarea fallida.
- Debilitar el oráculo para pasar a verde se escala, no se hace. Mecánicamente ya
  está cerrado: el oráculo queda fuera del `Boundary`.

## SHOULD

- **Riesgo por tarea (0/1/2)**, para que la ceremonia sea proporcional: un cambio
  de copy y una policy de RLS no pueden costar lo mismo.
- **Mutation testing** sobre módulos críticos, **periódico y nunca por tarea**:
  por tarea revienta el ciclo y los 15 minutos de review.

## MAY

- **Feature flag solo en la rebanada que llega a producción** antes de que la
  feature esté completa. Una flag por tarea es dead code combinatorio más ramas
  que el oráculo también tiene que cubrir: confunde unidad de trabajo con unidad
  de release.

## MUST NOT

- Descomponer por capas (todo el schema → todos los endpoints → toda la UI).
- Generar oráculo e implementación en la misma pasada.
- Encadenar tareas sin gate de validación entre ellas.
- Usar prosa como dependencia entre tareas.
- Planificar una tarea cuyo oráculo no sabés nombrar. Eso es un spike: se hace,
  se tira, y recién después se planifica.

## Umbrales

| Métrica | Objetivo | Acción si se excede |
|---|---|---|
| **¿El contrato cierra sin que el ejecutor explore?** | sí | **Es el umbral que manda.** Si no cierra: falta reconocimiento (F1) o falta diseño |
| Archivos tocados | 3-8 | >8 → partir; <2 → mirar si es un paso interno |
| Asserts del rojo | 3-7 | >7 → la rebanada tiene dos comportamientos |
| LOC de producción | 150-400 | señal, nunca gate |
| Review humano | ≤15 min | partir |

Dos métricas que **no** son umbral, a propósito:

- **Tokens de contexto por tarea.** El contexto del ejecutor se paga una vez y
  muere con él; lo caro es el del loop. La restricción real es que el contrato
  cierre — y eso es verificable al escribirlo, no estimable.
- **Ratio test:código.** Gameable con tests verbosos, y un agente optimiza a la
  métrica que le pongas. El criterio honesto: **cada assert debe poder nombrar el
  cambio de producción que lo haría fallar.**

## Ready / Done

**Ready** — oráculo nombrado · asserts del rojo escritos · rojo demostrado y
genuino · `Boundary` salido del grafo · `Depends` en verde · contrato cerrado.

**Done** — rojo demostrado → verde mínimo → refactor en verde · G1/G2/G3 en verde
· `Produces` publicado con las firmas reales · diff dentro del `Boundary`.
```

## Acción: `curar`

Disparador: terminaste una feature/tarea (o el usuario pide curar). Procedimiento:

1. **Reuní lo aprendido, sin ensuciar tu contexto.** Despachá un `explorador`
   (Sonnet) para que lea el diff de la tarea, el plan/spec si existe, y resuma qué
   costó, qué se decidió y qué trampa se pisó. Si la sesión guardó observaciones en
   engram, `mem_search` por el tema. Vos recibís el resumen, no los volcados.
2. **Filtrá por durabilidad.** Quedate solo con lo **reutilizable**: lo efímero
   (estado de la tarea, notas de una iteración) NO se captura. Cada candidato a
   skill se ancla en **algo concreto** leído (una línea de log, un patrón de rechazo
   del juez, una decisión del plan, un fix real). "Parece útil" no basta.
3. **Dedup antes de escribir.** Si `CLAUDE.md`, una skill local ya existente, o una
   observación de engram ya cubre eso, **extendé lo existente** en vez de crear un
   duplicado. No repitas en una skill local lo que el `CLAUDE.md` slim del estándar
   ya dice.
4. **Escribí / extendé / borrá** las skills locales en `.claude/skills/` del repo:
   - crear las que falten (una preocupación por archivo, esquema de arriba);
   - extender las que quedaron cortas con lo nuevo;
   - **borrar con criterio**: solo lo genuinamente obsoleto o contradicho por una
     decisión más reciente (p. ej. una skill de entorno tras migrar de stack); ante
     la duda, conservar y anotar la posible caducidad.
   Actualizá también `planificar` si la tarea reveló algo sobre cómo trocear en
   este repo.
5. **Commit.** Las skills locales se versionan: `git add .claude/skills/` en el
   mismo commit (o uno contiguo) al del trabajo que las originó, para que viajen con
   el código. Mensaje claro: `chore(skills): curar conocimiento local — <tema>`.
6. **Reportá** qué skills creaste/extendiste/borraste y por qué (anclado en
   evidencia). Ese informe es output, no una puerta que bloquee.

## Acción: `promover` (local → global)

Disparador: al curar, detectás que una skill local (pitfall/metodología/decisión)
ya existe —en esencia— en **2 o más repos** de clientes distintos, o contradice
algo del estándar global. Procedimiento:

1. **Verificá la recurrencia con evidencia**: citá las skills locales equivalentes
   (repo + ruta) o las observaciones de engram que la respaldan. Una sola aparición
   no se promueve.
2. **Redactá la propuesta como cambio concreto** al repo de estándares
   (`pabloRB25/coding_practices_alyp`): a qué contrato o skill pertenece, el diff
   propuesto, y el bump de `version:` que corresponde.
3. **Abrí un PR a `develop`** de ese repo con la propuesta (o dejá el paquete listo
   y avisá, si no tenés el repo a mano). El veredicto de incorporarla es del
   orquestador/usuario, no tuyo.
4. La skill local NO se borra al promover: se le anota `promovida: <PR>` y se
   elimina recién cuando la versión nueva del estándar esté instalada en ese repo.

## Reglas comunes

- **Autónomo, no interactivo.** Puede correr al cierre de una tarea o dentro de un
  loop sin humano delante. Decide y aplica con estos criterios; no deja decisiones
  "para que las tome el usuario".
- **No implementa código de producto** ni toca el plan/tareas. Solo escribe sobre
  `.claude/skills/` del repo — con una única excepción: la acción `promover`, que
  puede abrir un PR de propuesta en el repo de estándares
  (`pabloRB25/coding_practices_alyp`).
- **Todo anclado en evidencia.** Cada skill creada o borrada se justifica en algo
  concreto leído.
- **No duplica.** Ni a engram, ni a `CLAUDE.md`, ni entre skills locales.
- **Durabilidad.** Una skill local es conocimiento reutilizable, no un apunte de una
  iteración.
- **Una preocupación por archivo.** Si una skill mezcla dos cosas, partila.

## Cuándo NO actuar

Si solo se está revisando o manteniendo esta skill (no hay un repo de cliente con
trabajo recién cerrado sobre el que destilar), no ejecutes la acción `curar`.
