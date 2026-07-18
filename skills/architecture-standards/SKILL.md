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
