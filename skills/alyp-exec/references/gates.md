# Gates G0 · G1 · G2 · G3

**G1–G3 son mecánicos**: piso de aceptación de **todo** trabajo delegado, en
**todo** nivel de riesgo —incluido riesgo 0—, y son comandos, no razonamiento:
no consumen juicio ni contexto más allá de su salida recortada. Implementan el
invariante 7 de `contracts/orchestration.md`.

**G0 es de juicio, y es el único que corre ANTES de ejecutar.** Existe porque
G1–G3 protegen el *resultado* contra el ejecutor, pero no protegen el *criterio*
contra quien lo escribió. Implementa el invariante 8.

| Gate | Cuándo | Quién | Naturaleza |
|---|---|---|---|
| **G0** | antes de la ola | tier razonador invocado | juicio, sobre el contrato |
| **G1** | por tarea / por ola | el loop | comando |
| **G2** | por tarea | el loop | comando |
| **G3** | antes de la ola siguiente | el loop | comando |

---

## G0 · Firma de contratos de ola

> **El problema que resuelve**: el invariante 7 dice que la evidencia la genera
> quien juzga. Pero el `verificacion` que se re-ejecuta en G1, la allowlist que
> compara G2 y el `riesgo` que decide cuánto juicio se aplica **los escribe el
> loop**. Respecto de ese artefacto el loop es la parte juzgada: si redacta el
> criterio con el que después se absuelve, el sello de goma vuelve un nivel más
> arriba. G0 es el único punto del sistema donde el juicio es inevitable *antes*
> de que se ejecute nada.

**Aplica a**: contratos de riesgo ≥1. Los de riesgo 0 pasan directo (el piso
mecánico de abajo es lo que impide que "riesgo 0" sea una etiqueta de escape).

**Paquete que recibe el firmante** (acotado a propósito — es lo que lo mantiene
barato):

```
- objetivo de la ola (≤5 líneas) + el plan del que sale
- los N contratos completos (~15 líneas c/u)
- el piso de riesgo calculado por rutas (salida del comando, no la opinión del loop)
- NADA de código
```

**Devuelve, por contrato**: `firmado` · `corregir: <qué>` · `subir riesgo a N`.

**Qué mira** — cuatro preguntas, en este orden:

1. **¿El `objetivo` es decidible por un tercero sin opinar?** Si admite dos
   lecturas, el ejecutor elegirá una y G1 la bendecirá.
2. **¿El `verificacion` ejerce de verdad el objetivo?** Es la falla más cara del
   sistema: un comando flojo deja los tres gates mecánicos huecos y produce
   "todo verde, producto equivocado". Confirmá que falla si el objetivo no se
   cumple — no solo que pasa cuando sí.
3. **¿El `riesgo` está bien clasificado?** Contrastá contra el piso por rutas.
   Subclasificar es cómo un cambio de riesgo 2 esquiva la revisión del diff.
4. **¿La allowlist excluye los artefactos de verificación?** Invariante 7(b).

**Agregación**: G0 se firma por ola, y por lote de olas si el plan está cerrado y
las tareas son homogéneas. No se firma por tarea suelta — pagarías la invocación
N veces por un paquete que cabe entero en una.

**Umbral**: una ola íntegramente de riesgo 0 **no invoca G0**. El costo fijo de
la invocación no se paga para firmar lo que ningún juicio va a cambiar. Es el
mismo criterio del umbral de lote del carril local.

### Piso de riesgo mecánico (sin juicio)

G0 no es la primera defensa contra un riesgo subclasificado: es la segunda. La
primera es un comando. Si la allowlist de una tarea toca cualquiera de estas
rutas, su `riesgo` es **2 automático**, sin negociación:

```
supabase/migrations/**      **/auth/**           middleware.ts
**/rls/**                   **/*.policy.sql      .env*
**/webhooks/**              **/pagos/**          **/billing/**
```

El perfil del repo puede ampliar la lista, nunca recortarla. Se calcula sobre la
allowlist declarada —antes de ejecutar— y su salida entra al paquete de G0 como
dato, no como opinión del loop.

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
