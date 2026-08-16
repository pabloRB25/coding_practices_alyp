# Gates mecánicos G1 · G2 · G3

Piso de aceptación de **todo** trabajo delegado, en **todo** nivel de riesgo —
incluido riesgo 0. Son comandos, no razonamiento: no consumen juicio ni contexto
más allá de su salida recortada.

Implementan el invariante 7 de `contracts/orchestration.md`.

---

## G1 · Re-ejecución independiente

Corré el `verificacion` literal del contrato, de tu lado.

```bash
rtk vitest run <ruta del contrato> --reporter=dot
```

**Qué lo hace válido**: el comando lo escribiste **vos, antes** de que el ejecutor
trabajara. Esa anterioridad es lo único que lo vuelve falsable. Un comando que el
ejecutor propone después de trabajar no sirve como gate: mide lo que él decidió
que mida.

### La guarda de vacío (obligatoria)

**Exit 0 no alcanza.** Un comando que matchea 0 casos sale 0 y no probó nada. Es
el falso verde más común y el más difícil de ver en un reporte.

| Runner | Forma segura |
|---|---|
| vitest / jest | `--reporter=verbose` y confirmar `Tests N passed` con **N > 0**. `--passWithNoTests` **prohibido** en un gate. |
| pytest | `-q` y confirmar el conteo; `--exitfirst` para cortar rápido. Exit 5 = "no collected" → tratalo como ❌. |
| playwright | `--reporter=line`; confirmar `N passed` con N > 0. |
| tsc | `rtk npm run typecheck` — acá el verde vacío no aplica (o compila o no). |
| lint | `rtk lint eslint <paths>` — idem. |

### Agregado por ola

Si la ola es grande, un G1 agregado por ola cuesta menos que N invocaciones y
alcanza — siempre que el comando agregado **cubra** los criterios de todas las
tareas. Si una tarea tiene un criterio que el agregado no ejerce, esa tarea
necesita su G1 propio.

---

## G2 · Allowlist

```bash
rtk git diff --name-only
```

Compará contra el campo `archivos` del contrato. **Cualquier archivo fuera de la
allowlist = `❌` automático, sin juicio y sin negociación.**

Es binario y no interpretable a propósito: es el gate que no requiere que
entiendas el cambio para aplicarlo.

### Por qué la allowlist excluye los tests

Si el ejecutor puede modificar el artefacto que lo mide, la medición no vale. El
modo de falla no necesita mala fe: un agente atascado en un test que no pasa
tiende a "arreglar" el test. G2 lo detecta sin leer una línea de código.

Cuando la tarea SÍ es escribir tests, ver la nota correspondiente en
`references/contrato-tarea.md`: el criterio no puede ser "los tests pasan".

---

## G3 · Gate de ola (integración)

Antes de despachar la ola siguiente:

```bash
rtk npm run typecheck && rtk vitest run
```

o el gate del repo si lo tiene declarado (`pnpm verify` en repos con
`agentic-standard: v1`).

**Por qué existe**: la partición por archivos disjuntos de F0 garantiza que las
tareas no se pisen en disco — **no** garantiza que sean independientes en
semántica. Tipos compartidos, contratos de API entre módulos, side effects en
barrels: todo eso se rompe entre tareas que individualmente están en verde.

G3 es lo único del sistema que caza **integración rota entre tareas verdes**.

> Un `❌` de G3 no es falla de una tarea: es falla de ola. No lo mandes de vuelta
> a un solo ejecutor — clasificá primero (§8 del SKILL) y armá una tarea de
> integración con su propio contrato.

---

## Registro

La salida de los tres gates va a `.claude/run/<slug>/gates/<ola>.txt`. Tu contexto
recibe solo el veredicto y, si es rojo, las líneas de la falla — nunca el log
completo (R1/R2).
