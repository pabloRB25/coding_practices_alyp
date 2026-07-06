---
name: alyp-maestro
version: 1.0.0
provides: [curaduria]
description: >
  Curador del conocimiento LOCAL de un proyecto Alyp. Tras cerrar una feature o
  tarea, destila lo aprendido en skills locales versionadas en el repo del
  cliente (.claude/skills/<nombre>/SKILL.md): metodologías, pitfalls y decisiones
  durables que Claude auto-carga en futuras sesiones de ESE proyecto. Complementa
  engram (recall de hechos) — no lo duplica. Incluye la skill fija `planificar`.
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

## La skill fija `planificar`

`planificar` es la **única** skill local con nombre fijo y consumidor fijo: la usa
quien descompone el trabajo en este repo (vos en Opus, o `writing-plans`) **antes**
de generar subtareas. Recoge la metodología de planificación de ESTE proyecto: cómo
trocear, qué granularidad funciona, qué prerrequisitos respetar, qué orden. El
maestro la crea y la mantiene viva con lo aprendido, como cualquier otra skill local.

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
   (`alyp-studio/coding_practices_alyp`): a qué contrato o skill pertenece, el diff
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
  (`alyp-studio/coding_practices_alyp`).
- **Todo anclado en evidencia.** Cada skill creada o borrada se justifica en algo
  concreto leído.
- **No duplica.** Ni a engram, ni a `CLAUDE.md`, ni entre skills locales.
- **Durabilidad.** Una skill local es conocimiento reutilizable, no un apunte de una
  iteración.
- **Una preocupación por archivo.** Si una skill mezcla dos cosas, partila.

## Cuándo NO actuar

Si solo se está revisando o manteniendo esta skill (no hay un repo de cliente con
trabajo recién cerrado sobre el que destilar), no ejecutes la acción `curar`.
