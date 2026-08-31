# Doctrina de decisión arquitectónica — architecture-standards v1

Este archivo es **doctrina de decisión** (cómo decidir, cuándo escalar, en qué
formato dejar registro). El **detalle normativo agnóstico de stack** — capas
desacopladas, Twelve-Factor, SOLID/DDD, resiliencia (idempotencia, timeouts,
retries, circuit breakers, fail-closed), y el modelo C4/arc42 — vive en
`contracts/engineering-baseline.md#02-arquitectura` y **no se duplica aquí**.
Ante cualquier conflicto entre este documento y el contrato, **el contrato
manda** (ver regla general en `contracts/manifest.md`).

> Nota de origen: no había export disponible desde claude.ai al momento de
> escribir este documento (Ola 0 del plan de remediación, 2026-07-17). Este
> es el **fallback** reconstruido desde `engineering-baseline.md#02` + la
> doctrina ya validada. La reconciliación repo↔claude.ai (si el export
> aparece más adelante) queda diferida a Task 6.1 — el repo es la fuente de
> verdad.

## 1. Monolito modular como hipótesis, no como default

Al concebir un proyecto o al agregar una pieza estructural nueva (servicio,
worker, límite de dominio), el punto de partida del análisis es: **¿esto
necesita nacer separado?**

- Evaluar primero el monolito modular (costo y simplicidad más bajos).
- Separar desde el inicio **solo** si hay una razón real y presente, no
  hipotética: escalado independiente medible, equipo autónomo con cadencia de
  release propia, límite de dominio duro (bounded context con reglas de
  negocio incompatibles), o requisito de aislamiento (seguridad, compliance,
  runtime distinto).
- "Podría necesitarlo en el futuro" no es una razón válida — es exactamente
  el costo que el monolito modular evita pagar por adelantado.
- La decisión (separar o no) es siempre un ADR, incluso cuando el resultado
  es "seguimos en el monolito" — la ausencia de ADR no es una decisión
  documentada.

## 2. Puertas de una vía vs. dos vías

Clasificar toda decisión estructural antes de tomarla:

| Tipo | Ejemplos | Tratamiento |
|---|---|---|
| **Dos vías** (reversible) | elegir una librería interna, reorganizar carpetas, nombrar un módulo | Se decide rápido, se registra brevemente (puede ser un ADR corto o una nota en el PR); no bloquea. |
| **Una vía** (irreversible o cara de revertir) | esquema de datos público, contrato de API expuesto a terceros, proveedor de identidad/auth, separar un servicio, elegir un proveedor de infraestructura con lock-in | Análisis obligatorio + ADR completo + routing al nivel de decisión que corresponda (`contracts/execution.md`: duda decidible → `consultor`/Fable; arquitectura sin cierre → escalar al orquestador). |

Regla operativa: ante la duda de si una puerta es de una o dos vías, tratarla
como de una vía. El costo de un ADR de más es bajo; el costo de una migración
de esquema o de proveedor de identidad sin análisis previo es alto.

## 3. Formato de ADR

Ubicación: `docs/adr/NNNN-<slug>.md`, numeración incremental, archivos
inmutables una vez mergeados. Una decisión que cambia **no edita** el ADR
existente: crea un ADR nuevo que referencia y supersede al anterior.

Formato mínimo (secciones obligatorias):

```markdown
# NNNN. <Título de la decisión>

## Contexto
¿Qué problema o disyuntiva motiva esta decisión? ¿Qué restricciones existían?

## Decisión
¿Qué se decidió, en una o dos frases directas?

## Alternativas evaluadas
Lista de opciones consideradas y por qué se descartaron (incluye "no hacer
nada"/mantener el statu quo si era una alternativa real).

## Consecuencias
Efectos esperados, positivos y negativos, sobre el sistema y el equipo.

## Reversibilidad
Una vía / dos vías, y por qué. Si es de una vía: qué haría falta para
revertirla y con qué costo estimado.
```

Un ADR que supersede a otro debe declararlo explícitamente en su propio
`Contexto` (ej.: "Supersede a 0007 porque...").

## 4. Cuándo se invoca este skill

- Fase de diseño (incluso desde brainstorming), cuando la feature toca
  estructura: nuevo servicio/worker, límite de dominio, contrato público de
  API, esquema de datos, elección de proveedor.
- Al concebir un proyecto nuevo (decisiones fundacionales de `alyp-new-project`).
- Al auditar arquitectura existente (revisión de deuda estructural).

En todos los casos, este skill **decide y produce el ADR**; el detalle
normativo que sustenta la decisión (por qué 12-Factor, por qué idempotencia,
qué es C4) se consulta en `contracts/engineering-baseline.md#02-arquitectura`.
