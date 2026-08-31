---
name: alyp-graph
version: 1.0.0
description: >
  Calcula el radio de impacto real de un archivo (quién lo importa, qué tests lo
  ejercen, qué módulos toca, y el piso de riesgo mecánico del gate G0) para llenar
  el campo `archivos:` de un Contrato de Tarea con datos del grafo de imports en
  vez de con memoria. Invocar SIEMPRE antes de escribir la allowlist de un contrato
  de alyp-exec, y cuando el usuario pregunte "qué se rompe si toco X", "quién usa
  este archivo", "cuál es el radio de este cambio" o "cuánto riesgo tiene esta tarea".
---

# alyp-graph — el radio se calcula, no se recuerda

## Por qué existe

El gate G2 compara `git diff --name-only` contra la allowlist que **el propio
orquestador escribió**. Y el piso de riesgo de G0 se calcula sobre esa misma lista
(`gates.md:78-80`). Las dos verificaciones parten del mismo dato sin verificar: si
la allowlist omite `supabase/migrations/`, la tarea sale riesgo 0, saltea G0, saltea
la firma del tier razonador — y G2 la aprueba en verde.

Este skill rompe esa circularidad: la allowlist deja de ser una declaración y pasa
a ser la salida de un comando.

## Uso

El CLI viaja con este skill, en `assets/graph-impact.mjs`. Resolvelo contra el directorio
base que el harness inyecta al cargar el skill (la línea `Base directory for this skill:`).
Así funciona igual instalado por symlink (`--link`) que por copia (`--copy`), y con
cualquier `--target` — no hay ninguna ruta de una máquina concreta escrita acá. En una
instalación por defecto ese directorio es `~/.claude/skills/alyp-graph`.

    node <directorio-base-del-skill>/assets/graph-impact.mjs \
      --repo <ruta absoluta del repo> \
      --file <ruta relativa> \
      --extra <lista|ninguno> \
      [--depth 2] [--json]

`--depth 2` es el default. Subilo a 3 solo para infraestructura compartida (un cliente
de DB, un logger) — y mirá el techo: si la salida dice que superás 40 archivos, el
problema es el corte de la tarea, no el depth.

## `--extra` es obligatorio, y por qué

**El grafo de imports no puede ver tres de las nueve rutas de riesgo 2:**
`supabase/migrations/**`, `**/*.policy.sql` y `.env*`. No son módulos JS/TS: nadie
las importa, y en esta flota `supabase/` vive en la raíz del repo, fuera de las
carpetas que el CLI escanea.

Si el CLI corriera sin esa declaración, devolvería `riesgo_piso: 0` **justo en el
caso que este skill existe para atrapar** — y con formato de evidencia, que es peor
que una lista escrita de memoria. Por eso sale con código 3 y no emite nada.

**Otros códigos de salida** (ninguno emite bloque pegable salvo el 0):
`2` argumentos o rutas inválidas · `3` falta `--extra` · `4` la allowlist supera el
techo de 40 (emite el bloque, pero partí la tarea) · `5` el archivo objetivo no entró
al grafo. El 5 importa: un radio calculado sin el archivo objetivo es **vacío**, no
es 0, y son indistinguibles al mirar la salida. Suele significar que el repo no tiene
`node_modules` instalado —`dependency-cruiser` decide qué extensiones escanear según
si puede resolver `typescript`— o que el path no es relativo a la raíz del repo.

- `--extra supabase/migrations/0007_x.sql` → la tarea toca eso. El piso sube a 2.
- `--extra ninguno` → declarás que no toca ninguno. Queda registrado en la salida,
  y G0 audita **esa declaración**, no el silencio.

Un archivo que todavía no existe (lo va a crear la tarea) es un `--extra` válido:
el CLI avisa pero no falla.

## Cómo se lee la salida

| Campo | A dónde va en el Contrato de Tarea |
|---|---|
| `archivos:` | directo al campo `archivos:` — es la allowlist |
| tests | **NO** van en `archivos:`. Alimentan `verificacion:`. Si el ejecutor puede editar el test que lo mide, la medición no vale (invariante 7b) |
| módulos tocados | si es >1, la tarea probablemente hay que partirla |
| `piso de riesgo` | si es 2, el contrato **es** riesgo 2. No es negociable ni opinable |
| `medido por el grafo` / `aportado por --extra` | G0 los audita distinto: lo medido se re-ejecuta, lo declarado se cuestiona |

## Los cuatro límites que tenés que saber

1. **No ve tres de las nueve rutas de riesgo** (arriba). Es una propiedad del grafo,
   no un bug: por eso `--extra` es obligatorio. Si algún día el CLI acepta correr sin
   `--extra`, este skill volvió a ser peligroso.
2. **Solo ve imports estáticos.** `import()` dinámico, imports por string construido,
   y las rutas de Next.js resueltas por convención de carpetas **no aparecen**. La
   salida es un piso del radio, nunca un techo.
3. **No ve el grafo de datos.** Que un archivo toque una tabla con RLS no se deduce
   de los imports. El piso de riesgo por rutas lo cubre parcialmente; el resto es G0.
4. **Un radio vacío es sospechoso, no tranquilizador.** Si `dependents` sale vacío
   para un archivo que no es un entrypoint, lo más probable es que el grafo no
   resolvió los alias del `tsconfig` — no que el archivo esté aislado.
