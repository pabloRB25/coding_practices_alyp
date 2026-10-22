# Gates G0 · G1 · G2 · G3 · G4

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
| **G1↓** | antes de la ola (F0) | el loop | comando — el oráculo en **rojo** |
| **G1↑** | por tarea / por ola | el loop | comando — el oráculo en **verde** |
| **G2** | por tarea | el loop | comando |
| **G3** | antes de la ola siguiente | el loop | comando — acotado a la ola |
| **G4** | una vez, al cerrar el plan | el loop | comando — suite completa |

**Regla de alcance**: G1, G2 y G3 prueban **solo lo que la tarea u ola construye o
cambia**. La suite completa del repo vive en G4 y corre una sola vez. Un gate de
tarea u ola que la invoque es un contrato mal escrito: G0 lo rechaza.

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
- la salida del rojo previo (G1↓) de cada oráculo
- NADA de código
```

**Devuelve, por contrato**: `firmado` · `corregir: <qué>` · `subir riesgo a N`.

**Qué mira** — cuatro preguntas, en este orden:

1. **¿El `objetivo` es decidible por un tercero sin opinar?** Si admite dos
   lecturas, el ejecutor elegirá una y G1 la bendecirá.
2. **¿El `verificacion` ejerce de verdad el objetivo?** Es la falla más cara del
   sistema: un comando flojo deja los gates mecánicos huecos y produce "todo
   verde, producto equivocado". **Ya no lo estimás**: el paquete trae la salida
   de G1↓, el oráculo corrido en rojo. Lo que juzgás es si ese rojo es genuino
   —falla por el objetivo ausente— o falso (módulo que la tarea no crea, typo,
   0 casos). Un `rojo_esperado: no aplica` fuera del oráculo `estructural` es un
   `corregir:`.
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

Eso lo vuelve exactamente tan bueno como la allowlist — y por eso la allowlist ya
no se declara de memoria: sale de `alyp-graph` (propiedad 3 de `archivos:` en
`contrato-tarea.md`).

**G0 verifica esa procedencia, y audita las dos mitades distinto.** El paquete que
recibe el firmante incluye la salida cruda de `alyp-graph`, no solo la lista final.

- **Lo que midió el grafo** se re-ejecuta: todo archivo que el grafo devolvió y la
  allowlist omite es un `corregir:`. La omisión es el camino por el que un riesgo 2
  se presenta como riesgo 0.
- **Lo que aportó la declaración `--extra`** se cuestiona, porque no se midió. Tres
  de las nueve rutas de riesgo 2 —`supabase/migrations/**`, `**/*.policy.sql`,
  `.env*`— son invisibles para un grafo de imports: no son módulos. Un
  `--extra ninguno` en una tarea que crea una tabla, cambia una policy o toca una
  variable de entorno es un `corregir:`, aunque el CLI haya salido en verde.

**El firmante no puede delegar en el grafo la pregunta "¿esto toca la base?".** El
grafo contesta "quién importa a quién". Esa otra pregunta sigue siendo de G0.

---

## G1 · Re-ejecución independiente — en rojo antes, en verde después

El mismo comando, corrido dos veces **por vos**, a ambos lados del trabajo. La
primera prueba que el oráculo **puede** fallar; la segunda, que **dejó** de
fallar. Sin la primera, la segunda no distingue "lo implementó" de "el comando
nunca midió nada".

### G1↓ · El rojo (F0, antes de despachar)

Con el repo como está, el `verificacion` **debe fallar**, y fallar por el objetivo
ausente. Su salida se pega en `rojo_esperado` y va al ledger.

> **Criterio único**: el rojo tiene que desaparecer **exactamente** cuando el
> objetivo se cumple, y por ninguna otra razón.

| Salida | Veredicto |
|---|---|
| Falla en el assert (`expected 422, got undefined`) | ✅ rojo genuino |
| `X is not a function`, siendo `X` el símbolo que **esta** tarea crea | ✅ genuino pero **débil**: ejerce existencia, no comportamiento. El verde debe llegar por assert |
| `Cannot find module` de algo que esta tarea **no** crea | ❌ falso — el oráculo está mal cableado |
| `SyntaxError` en el archivo del oráculo | ❌ falso — hay un typo, no una feature ausente |
| `No test files found` · `0 collected` | ❌ falso — el comando no matchea nada |
| exit 0 | ❌ el oráculo no ejerce el objetivo, o el objetivo ya está cumplido |

Un rojo falso no es "casi un rojo": es la **ausencia de oráculo, disfrazada**. Y
sale barato cazarlo acá — antes de pagar la invocación de G0 y el trabajo de la ola.

Se saltea solo con `rojo_esperado: no aplica — <por qué>` declarado (oráculo
`estructural`, o tarea cuyo entregable *es* el oráculo). G0 lo audita.

### G1↑ · El verde (F4a, al volver)

Corré el `verificacion` literal del contrato, de tu lado.

```bash
rtk vitest run <ruta del contrato> --reporter=dot
```

**Qué lo hace válido**: el comando lo escribiste **vos, antes** de que el ejecutor
trabajara —y ya lo viste fallar—. Esa anterioridad, más esa demostración, son lo
que lo vuelve falsable. Un comando que el ejecutor propone después de trabajar no
sirve como gate: mide lo que él decidió que mida.

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

Que el oráculo esté fuera de la allowlist es posible porque **ya existe antes de
la ola**: lo materializa F0 y lo corre G1↓. Las dos reglas son la misma pieza
vista de los dos lados.

Cuando la tarea SÍ es escribir tests, ver la nota correspondiente en
`references/contrato-tarea.md`: el criterio no puede ser "los tests pasan".

---

## G3 · Gate de ola (integración)

Antes de despachar la ola siguiente, sobre la rama con la ola integrada:

```bash
pnpm turbo run typecheck lint --filter='...[<base de la ola>]'   # o tsc/eslint de lo afectado
rtk vitest run <rutas de los verificacion de TODAS las tareas de la ola> --reporter=verbose
# + pgTAP / playwright solo de los archivos de esos contratos
```

Es el **lote** junto (invariante 7c), no el repo. Prohibido en G3: `pnpm verify`,
`vitest run` sin rutas, `supabase test db` sin archivos, e2e completos. Si el repo
declara un gate propio que corre la suite entera (`pnpm verify` en repos con
`agentic-standard: v1`), ese gate va a **G4**, no acá. Si el plan declara su
`G3_ola`, manda el del plan siempre que respete esta regla.

**Por qué existe**: la partición por archivos disjuntos de F0 garantiza que las
tareas no se pisen en disco — **no** garantiza que sean independientes en
semántica. Tipos compartidos, contratos de API entre módulos, side effects en
barrels: todo eso se rompe entre tareas que individualmente están en verde.

G3 es lo único del sistema que caza **integración rota entre tareas verdes**.

> Un `❌` de G3 no es falla de una tarea: es falla de ola. No lo mandes de vuelta
> a un solo ejecutor — clasificá primero (§8 del SKILL) y armá una tarea de
> integración con su propio contrato.

---

## G4 · Gate de cierre (suite completa, una vez)

Al integrar y cerrar el plan —después de la última ola, antes del veredicto de
merge final y de cualquier PR a la rama principal—:

```bash
pnpm verify            # o el gate completo del repo: lint, typecheck, TODOS los tests
supabase test db       # todo pgTAP, si el repo lo usa
# + e2e / recorrido de punta a punta, si el plan lo define
```

**Por qué una sola vez**: G1 y G3 ya probaron cada contrato y cada lote. Lo único
que G4 agrega es lo que ningún oráculo acotado mira —regresiones lejos de lo
tocado—, y eso no cambia ola a ola. Correr la suite en cada tarea u ola costó
10,4 h en una sola tarea (FaciliGroup L9-BAJA) sin cazar nada que G1+G3 no cazara.

**Si falla**: clasificá (§8 del SKILL), arreglá con un contrato propio y
re-ejecutá **solo** los archivos que fallaron más los oráculos de lo tocado. G4
se repite **una** vez para confirmar el cierre; nunca por cada arreglo. Registrá
el comando y su duración en `.claude/run/<slug>/gates/cierre.txt`.

Un plan con etapas que se entregan por separado puede declarar un cierre de etapa
**liviano** (cobertura de contrato, pgTAP de sus migraciones, humo HTTP); la suite
completa sigue siendo solo de G4.

---

## Registro

La salida de los gates —incluido el rojo de G1↓— va a
`.claude/run/<slug>/gates/<ola>.txt`. Tu contexto
recibe solo el veredicto y, si es rojo, las líneas de la falla — nunca el log
completo (R1/R2).
