# Contrato: orquestación multi-modelo (v1.2)

Protocolo agnóstico de modelos concretos. Los 6 roles son TIERS; el mapeo
tier→modelo y los límites del entorno viven en `capacity.yaml` (por máquina).

## Modo estándar (desde protocolo v2.7)

- **El orquestador (loop principal) es el tier razonador**, con autoridad plena
  operativa: routing, síntesis, razonamiento pesado y veredicto final.
- **El tier juez no orquesta**: se ejerce por **invocación explícita** (agente
  consultor) ante duda real del orquestador o pedido del usuario. Es desempate,
  no par de programación.
- **El offloading al mecánico es OPCIONAL según entorno** (desde v1.2). Cuando el
  perfil lo declara disponible y el costo fijo de delegar es menor que el trabajo
  delegado, es obligatorio para lo verificable + inequívoco. Cuando no —costo fijo
  mayor al trabajo, tier ausente, o el perfil lo excluye del camino crítico— se
  prescinde de él y el perfil lo documenta. Ver invariante 2.

## Tiers

| Tier | Rol | Nunca hace |
|---|---|---|
| **juez** | veredicto final: seguridad crítica, merge/prod, irreversibles; síntesis; routing | delegarse el veredicto |
| **razonador** | análisis pesado con spec cerrada: seguridad (borrador), arquitectura, debugging endiablado, juez adversarial | exploración abierta (cara y lenta) |
| **obrero** | implementación, research, debugging normal, review no-crítico | veredictos de seguridad |
| **barato** | búsquedas amplias, triage, resúmenes | decisiones |
| **mecánico** | tareas verificables e inequívocas (tests, codemods, scaffolding) | nada ambiguo |
| **qa-automático** | veredicto tras cada edición/delegación | bloquear sin criterio (falsos positivos se evalúan) |

## Invariantes (independientes del entorno)

1. El contexto del orquestador es el recurso más caro: leé poco, delegá mucho,
   recibí resúmenes.
2. Al mecánico solo lo verificable + inequívoco. El offloading hacia él es
   **opcional según entorno** (v1.2): obligatorio donde el perfil lo declara
   disponible y rentable; prescindible —con constancia en el perfil— donde su
   costo fijo por delegación supera al trabajo delegado. Seguridad nunca baja del
   razonador y el veredicto nunca baja del orquestador (que escala al juez
   explícitamente si duda).
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

## Degradación

- Sin ejecutor local (`local.disponible: false`) o con el mecánico fuera del
  camino crítico por decisión de perfil: lo mecánico va al tier barato o al obrero.
- Sin hooks de QA local: el veredicto lo pide quien delega (no es error del trabajo).
- Orquestador de tier obrero: consulta obligatoria al tier juez en seguridad
  crítica, irreversibles y arquitectura.
