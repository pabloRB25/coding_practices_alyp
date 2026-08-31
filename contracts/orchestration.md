# Contrato: orquestación multi-modelo (v1.3)

Protocolo agnóstico de modelos concretos. Los 6 roles son TIERS; el mapeo
tier→modelo y los límites del entorno viven en `capacity.yaml` (por máquina).

## Modo estándar (desde protocolo v3.0)

- **El orquestador (loop principal) es el tier obrero.** Rutea, descompone en
  contratos de tarea, despacha olas, corre los gates mecánicos y sintetiza. No
  firma: rutea hacia quien firma.
- **El tier razonador no orquesta: valida por invocación.** Se lo llama con
  contexto fresco y paquete acotado para (a) **firmar los contratos de ola**
  antes de ejecutar, (b) el **diff de riesgo 2**, y (c) el **veredicto de
  merge**. Fuera de esos tres puntos no entra al camino crítico.
- **El tier juez no orquesta ni valida por rutina**: se ejerce por **invocación
  explícita** (agente consultor) ante duda real o pedido del usuario. Es
  desempate, no par de programación.
- **El offloading al mecánico es OPCIONAL según entorno** (desde v1.2). Cuando el
  perfil lo declara disponible y el costo fijo de delegar es menor que el trabajo
  delegado, es obligatorio para lo verificable + inequívoco. Cuando no —costo fijo
  mayor al trabajo, tier ausente, o el perfil lo excluye del camino crítico— se
  prescinde de él y el perfil lo documenta. Ver invariante 2.

> **Por qué cambió (v1.3).** El costo dominante del sistema no es qué tier
> ejecuta: es **cuánto contexto acumula el loop**, que se re-lee entero en cada
> turno. Medido sobre 95.034 requests (may–ago 2026): el loop concentraba el
> **83,8%** del costo —de los cuales `cache_read` solo es el **57,1% del total**—
> contra **5,6%** de los subagentes del tier razonador, que ya corrían acotados a
> ~90K de contexto. Bajar el loop de tier ataca el 83,8%; mover ejecución entre
> tiers atacaba el 5,6%. El invariante 1 ya lo decía; v1.3 lo hace estructural.

## Tiers

| Tier | Rol | Nunca hace |
|---|---|---|
| **juez** | desempate: conflicto de veredictos, arquitectura sin cierre, 2 fallos sobre lo mismo | entrar al camino crítico por ola |
| **razonador** | **validador invocado**: firma de contratos de ola (G0), diff de riesgo 2, veredicto de merge; y análisis pesado con spec cerrada | orquestar; exploración abierta (cara y lenta) |
| **obrero** | **loop orquestador**: routing, descomposición, gates mecánicos, síntesis. Y ejecución: implementación, research, debugging normal, review no-crítico | **veredictos de seguridad** |
| **barato** | búsquedas amplias, triage, resúmenes | decisiones |
| **mecánico** | tareas verificables e inequívocas (tests, codemods, scaffolding) | nada ambiguo |
| **qa-automático** | veredicto tras cada edición/delegación | bloquear sin criterio (falsos positivos se evalúan) |

> La fila **obrero** conserva intacta su prohibición: rutea hacia la firma, no
> firma. Que el loop sea de tier obrero no le da autoridad de veredicto.

## Invariantes (independientes del entorno)

1. El contexto del orquestador es el recurso más caro: leé poco, delegá mucho,
   recibí resúmenes.
2. Al mecánico solo lo verificable + inequívoco. El offloading hacia él es
   **opcional según entorno** (v1.2): obligatorio donde el perfil lo declara
   disponible y rentable; prescindible —con constancia en el perfil— donde su
   costo fijo por delegación supera al trabajo delegado. Seguridad nunca baja del
   razonador y **el veredicto nunca baja del tier razonador**: cuando el loop es
   de tier obrero, el veredicto de riesgo ≥2 y el de merge los firma el
   **razonador invocado** (G0 / F4b), que escala al juez explícitamente si duda.
   *(Enmendado en v1.3: hasta v1.2 la letra decía "nunca baja del orquestador",
   que ataba el veredicto a un rol de loop que este contrato ya no reserva al
   razonador. El espíritu —que el veredicto no baje de tier— se conserva.)*
3. Si dudás del tier, subí uno.
4. Nunca aceptar trabajo delegado sin resumen/veredicto con evidencia
   (`contracts/evidencia.schema.json`). Qué hace válida a esa evidencia lo fija
   el invariante 7.
5. Gobernador anti-estampida: nunca más delegaciones locales vivas que
   `local.max_delegaciones_vivas`.
6. Descomposición estándar ralph: subtareas desatendidas, juzgables, con evidencia
   de cierre y tier declarado por bloque.
7. **La evidencia que decide un veredicto la genera quien juzga, no quien es
   juzgado** (v1.2). Un reporte auto-declarado orienta el juicio; no lo funda —
   es forjable sin mala fe (salida stale, contexto de ejecución equivocado,
   criterio que pasa en vacío, o debilitamiento del propio criterio). Piso de
   aceptación de todo trabajo delegado, **en cualquier nivel de riesgo**:
   - **(a) Re-ejecución independiente.** Quien acepta re-ejecuta el criterio de
     verificación, que debe haber sido fijado **antes** de delegar: esa
     anterioridad es lo que lo vuelve falsable.
   - **(b) Gate de alcance.** Lo efectivamente tocado se compara con el alcance
     declarado en la delegación. El alcance **excluye los artefactos de
     verificación**, salvo que producirlos sea la tarea; si el ejecutor puede
     modificar aquello que lo mide, la medición no vale.
   - **(c) Gate de integración por lote.** Subtareas disjuntas por archivo no son
     necesariamente independientes por semántica: el lote se verifica entero
     antes de dar por cerrada la ola.
8. **Respecto del contrato de tarea, el loop es la parte juzgada** (v1.3). El
   invariante 7 protege el resultado de la ejecución, no su criterio: todo el
   sistema cuelga de que `objetivo`, `verificacion`, `riesgo` y `archivos` estén
   bien escritos, y **quien los escribe es el loop**. Un loop que redacta el
   criterio con el que después se absuelve reintroduce el sello de goma un nivel
   más arriba. Por eso, cuando el loop no es del tier razonador:
   - **(a) Firma previa.** Los contratos de riesgo ≥1 los firma el razonador
     invocado **antes** de despacharse la ola, sobre el contrato — no sobre el
     código. Es la única invocación de juicio que ocurre antes de ejecutar.
   - **(b) El firmante re-ejecuta lo que firma.** Para lo de riesgo 2, quien
     firma corre por su cuenta el gate de re-ejecución y el de alcance. Un
     paquete curado por el loop no funda una firma.
   - **(c) Piso de riesgo mecánico.** La clasificación de riesgo no puede
     depender solo del juicio del loop: el perfil declara rutas cuya sola
     presencia en la allowlist fuerza riesgo 2, sin juicio y sin negociación.
9. **La firma no es agregable donde el gate no alcanza.** Riesgo 0 y 1 cierran
   por gates mecánicos, y su firma puede agruparse por ola o por lote. El diff de
   riesgo 2 se firma **de a uno**: el modo de falla que cubre —la política
   ausente, el trust boundary que nadie testeó— es invisible para todo gate
   mecánico, y agregarlo lo diluye hasta volverlo ceremonial.

## Degradación

- Sin ejecutor local (`local.disponible: false`) o con el mecánico fuera del
  camino crítico por decisión de perfil: lo mecánico va al tier barato o al obrero.
- Sin hooks de QA local: el veredicto lo pide quien delega (no es error del trabajo).
- **Loop de tier obrero (modo estándar desde v1.3): firma obligatoria del tier
  razonador invocado** en seguridad crítica, irreversibles y arquitectura —
  ejercida como G0 sobre el contrato y como F4b sobre el diff. El tier juez queda
  para sus disparadores estándar (conflicto de veredictos, arquitectura sin
  cierre, 2 fallos sobre lo mismo), no por rutina.
  *(Enmendado en v1.3: hasta v1.2 esta línea exigía "consulta obligatoria al tier
  juez" para ese caso. Con el razonador ya invocado como validador estructural,
  esa consulta pasaba a ser rutina y sacaba al juez de su rol de desempate.)*
- **Sin tier razonador disponible**: no hay degradación válida para riesgo 2. Se
  detiene y se escala al usuario. Un loop obrero que firma su propio riesgo 2
  viola los invariantes 2 y 8 a la vez.
