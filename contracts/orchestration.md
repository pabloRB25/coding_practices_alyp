# Contrato: orquestación multi-modelo (v1)

Protocolo agnóstico de modelos concretos. Los 6 roles son TIERS; el mapeo
tier→modelo y los límites del entorno viven en `capacity.yaml` (por máquina).

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
2. Al mecánico solo lo verificable + inequívoco. Seguridad nunca baja del razonador
   y el veredicto nunca baja del juez/orquestador.
3. Si dudás del tier, subí uno.
4. Nunca aceptar trabajo delegado sin resumen/veredicto con evidencia
   (`contracts/evidencia.schema.json`).
5. Gobernador anti-estampida: nunca más delegaciones locales vivas que
   `local.max_delegaciones_vivas`.
6. Descomposición estándar ralph: subtareas desatendidas, juzgables, con evidencia
   de cierre y tier declarado por bloque.

## Degradación

- Sin ejecutor local (`local.disponible: false`): lo mecánico va al tier barato.
- Sin hooks de QA local: el veredicto lo pide quien delega (no es error del trabajo).
- Orquestador de tier obrero: consulta obligatoria al tier juez en seguridad
  crítica, irreversibles y arquitectura.
