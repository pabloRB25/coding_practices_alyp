# Reporte de Tarea (vuelta)

Lo escribe el ejecutor. **Tope duro: 40 líneas.** Es lo único que entra al
contexto del orquestador — todo lo que sobre acá se paga en cada turno siguiente
de la sesión.

## Plantilla

```
## Reporte <id>
veredicto:   ✅ | ⚠ | ❌
archivos:    <tocados + diffstat>
evidencia:   <comando ejecutado + últimas líneas de salida>
decisiones:  <≤3 bullets de decisiones no obvias>
riesgos:     <lo que el orquestador debe mirar, o "ninguno">
siguiente:   <sugerencia, o "ninguna">
```

## Qué significa cada veredicto

| | Significa | Cuándo |
|---|---|---|
| **✅** | Objetivo cumplido y verificación en verde, corrida por mí. | Único caso en que el trabajo se da por hecho. |
| **⚠** | Cumplido, pero hay algo que el orquestador debe decidir o mirar. | Decisión de diseño que excedía el contrato; efecto lateral previsto; deuda declarada. |
| **❌** | No cumplido tras agotar el presupuesto. | **Con diagnóstico.** Nunca un parche a medias. |

Un `❌` con buen diagnóstico vale más que un `⚠` optimista: el diagnóstico es lo
que permite clasificar la falla (contrato / ejecución / entorno) y no quemar
presupuesto escalando lo que no corresponde.

## Prohibido

- **Volcar código.** El diffstat dice qué cambió; el diff está en git.
- **Narrar el proceso** ("primero leí X, después noté que…").
- **Explicar línea por línea** lo que hiciste.
- **Reportar ✅ sin haber corrido el comando.** Es el peor modo de falla del
  sistema: convierte al orquestador en un sello de goma.

## El campo `evidencia` es informativo, no probatorio

Orienta el juicio del orquestador; **no lo funda**. La prueba real la regenera el
orquestador en G1, re-ejecutando el mismo comando de su lado.

Esto no es desconfianza en el ejecutor: la evidencia auto-reportada es forjable
sin mala fe alguna — salida stale de una corrida anterior, cwd equivocado, un
comando que matchea 0 casos y sale 0. Por eso el contrato `orchestration`
invariante 7 exige que la evidencia que decide un veredicto la genere quien juzga.

Pegá las **últimas líneas** de la salida (el resumen del runner), no la salida
completa.

## Ejemplo

```
## Reporte T-03
veredicto:   ⚠
archivos:    src/features/reservas/queries.ts  (+34 −2)
             src/features/reservas/index.ts    (+1 −0)
evidencia:   pnpm vitest run src/features/reservas/queries.test.ts
             Test Files  1 passed (1)
             Tests  7 passed (7)
decisiones:  - orden por fecha_entrada asc resuelto en SQL, no en JS (el índice
               idx_reservas_fecha ya existía y evita el sort en memoria)
             - 'completada' se incluye: el objetivo solo excluía 'cancelada'
riesgos:     listarReservasPorHuesped se usa también en el export de reportes
             (src/features/reportes/export.ts:88) — ahí el orden importaba al revés
siguiente:   confirmar el orden esperado en export.ts antes de cerrar la ola
```

Ese reporte es correcto por tres motivos: cabe en 15 líneas, el `⚠` señala algo
que el orquestador **no podía saber sin haber tocado el código**, y el campo
`riesgos` le da la ancla exacta (`archivo:línea`) para mirar solo eso — que es el
disparador 3 de §7.3 del SKILL.
