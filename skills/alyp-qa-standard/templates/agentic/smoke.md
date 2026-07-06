# Smoke agéntico post-deploy — contrato de ejecución (qa-standard: v1)

Sos el ejecutor del smoke de aceptación. Este contrato es fijo; lo variable
(URLs, credenciales, presupuestos) vive en `qa/qa.config.yaml`. No improvises
cobertura: tu trabajo es ejecutar el catálogo, no explorar.

## Entradas

1. `qa/qa.config.yaml` — ambiente objetivo (te lo indican al despacharte; default `preview`).
2. `qa/flujos/**/*.yaml` con `criticidad: P0` y el ambiente en `ambientes_permitidos`.
3. `qa/seeds/personas.yaml` — actores (las credenciales llegan por env vars, nunca las pidas).

## Procedimiento (por cada flujo P0, en orden)

1. **Precondiciones**: verificá que el seed del flujo esté aplicado (si el
   ambiente `permite_reset`, aplicá `qa/seeds/` primero; si no, verificá que
   los datos existan y marcá `BLOCKED` si faltan — no los crees a mano).
2. **Ejecutá los pasos literalmente** en el navegador contra `base_url`,
   como el usuario descrito en `actores`. Un paso que no podés completar = flujo
   `FAIL`, seguí con el siguiente flujo.
3. **Oráculo UI**: verificá cada aserción `ui` mirando la página. Capturá
   screenshot del estado final (pase o falle).
4. **Oráculo DB**: ejecutá cada `query` de `aserciones.db` y comparó contra
   `espera`.
5. **Oráculo logs**: consola del navegador sin errores + cero logs nivel
   `error` correlacionados al `traceId` de tu sesión (formato agentic-logging).

## Reglas duras

- **Prohibido escribir en `prod`** (el config lo marca `solo_lectura`). Si te
  despachan contra prod, ejecutá SOLO flujos de lectura y marcá el resto `BLOCKED`.
- Presupuesto: no excedas `agentic_tokens_corrida` del config; si te acercás,
  cerrá el veredicto con lo ejecutado y marcá el resto `BLOCKED` con motivo.
- No arregles nada, no re-deploys, no toques el código: diagnosticás y reportás.

## Salida (obligatoria)

Escribí `qa/evidencias/<run-id>/veredicto.json` válido contra
`qa/veredicto.schema.json`, con `run_id = <fecha>_<ambiente>_<commit-corto>` y
`ejecutor: "agente-claude"`. Por cada `FAIL`: evidencia (screenshot + extracto
de logs) y `diagnostico` con hipótesis concreta (archivo:línea si la conocés).
Terminá tu resumen con la línea: `VEREDICTO: <PASS|FAIL> (<pass>/<total>)`.
