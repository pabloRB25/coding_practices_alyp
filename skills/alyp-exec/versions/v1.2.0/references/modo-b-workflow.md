# Modo B — harness `Workflow`

Mismo loop, mismas estructuras, mismas reglas duras. Cambia solo quién ejecuta el
control de flujo: un script determinista en vez del modelo.

> ⚠️ **Regla #0.** Lanzar este Workflow **es ejecutar el plan**, incluso en dry
> run. Escribir el harness NO es autorización para correrlo. F0 produce el script
> y ahí parás, hasta el visto bueno explícito del usuario.

## Cuándo

Las tres condiciones, juntas: **plan cerrado** + **tareas homogéneas** +
**verificación programática**. Falta una → Modo A. La duración no es criterio:
una tarea larga y exploratoria es el peor caso para un harness.

## Qué gana Modo B

| Palanca | Detalle |
|---|---|
| `effort` por etapa | La tabla de §10 del SKILL **solo es operable acá**: la tool `Agent` no expone `effort`. |
| `pipeline()` sin barreras | El ítem 1 verifica mientras el ítem 5 implementa. Wall-clock = cadena más lenta, no suma de etapas. |
| `resumeFromRunId` | Reanuda sin re-pagar lo ya hecho. |
| `isolation: "worktree"` | Única vía de aislar tareas que tocan los mismos archivos. Caro (~200-500 ms + disco por agente): solo cuando hay conflicto real. |
| `schema` | Fuerza el Reporte de Tarea como objeto validado — el tope de 40 líneas deja de depender de la obediencia del ejecutor. |

## Las dos reglas duras del modo

1. **Los gates son ETAPAS del pipeline, no juicio.** Sin humano en el loop, el
   orquestador es un script y un script no ejerce discreción. G1/G2/G3 y la firma
   de riesgo 2 tienen que estar en el grafo, no en la cabeza de nadie.
2. **Los scripts no tienen acceso a filesystem ni a APIs de Node.** Un gate no se
   corre con `execSync`: se corre despachando un agente barato cuyo único trabajo
   es ejecutar el comando y devolver el resultado estructurado. Tampoco hay
   `Date.now()` ni `Math.random()` (romperían el resume).

## Esqueleto

```js
export const meta = {
  name: 'alyp-exec-ola',
  description: 'Ejecuta una ola de contratos con gates G1/G2/G3 como etapas',
  phases: [
    { title: 'Reconocimiento', detail: 'mapa compartido, una vez' },
    { title: 'Implementacion', detail: 'un ejecutor por contrato' },
    { title: 'Gates', detail: 'G1 re-ejecucion + G2 allowlist' },
    { title: 'Riesgo2', detail: 'revisor opus sobre los criticos' },
    { title: 'GateOla', detail: 'G3 integracion' },
  ],
}

const REPORTE = {
  type: 'object',
  required: ['veredicto', 'archivos', 'evidencia'],
  properties: {
    veredicto: { enum: ['ok', 'atencion', 'falla'] },
    archivos: { type: 'array', items: { type: 'string' } },
    evidencia: { type: 'string' },
    decisiones: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    riesgos: { type: 'string' },
  },
}

const GATE = {
  type: 'object',
  required: ['verde', 'casosEjecutados', 'salida'],
  properties: {
    verde: { type: 'boolean' },
    casosEjecutados: { type: 'integer' },   // guarda de vacío: 0 casos NO es verde
    salida: { type: 'string' },
    archivosFuera: { type: 'array', items: { type: 'string' } },
  },
}

// F1 — reconocimiento: UNA vez, se pega en los N contratos
phase('Reconocimiento')
const mapa = await agent(
  `Mapeá firmas, tipos y convenciones de: ${args.scope}. Devolvé anclas archivo:línea, no volcados.`,
  { model: 'haiku', effort: 'low', label: 'recon' }
)

// F2→F4a — pipeline: cada contrato implementa y pasa sus gates sin esperar a los demás
phase('Implementacion')
const resultados = await pipeline(
  args.contratos,

  // etapa 1 — implementación con contrato cerrado
  (contrato) => agent(
    `${contrato.texto}\n\n## Contexto compartido\n${mapa}\n\n` +
    `Corré tu verificación antes de devolver. Máx ${contrato.presupuesto} intentos. ` +
    `Si no cierra, devolvé veredicto "falla" con diagnóstico — nunca un parche a medias.`,
    { model: 'sonnet', effort: 'high', phase: 'Implementacion', label: `impl:${contrato.id}` }
  ),

  // etapa 2 — G1 + G2, ejecutados por un agente barato (el script no tiene shell)
  (reporte, contrato) => agent(
    `Ejecutá exactamente: ${contrato.verificacion}\n` +
    `Después: git diff --name-only\n` +
    `Devolvé: verde (exit 0 Y casosEjecutados > 0), casosEjecutados, últimas líneas, ` +
    `y archivosFuera = los tocados que NO estén en: ${contrato.archivos.join(', ')}`,
    { model: 'haiku', effort: 'low', phase: 'Gates', label: `gate:${contrato.id}`, schema: GATE }
  ).then((g) => ({ contrato, reporte, gate: g }))
)

const vivos = resultados.filter(Boolean)
const rechazados = vivos.filter((r) => !r.gate.verde || r.gate.archivosFuera?.length)
if (rechazados.length) log(`G1/G2 rechazaron ${rechazados.length} de ${vivos.length}`)

// F4b — riesgo 2: firma en tier razonador, nunca más abajo
phase('Riesgo2')
const criticos = vivos.filter((r) => !rechazados.includes(r) && r.contrato.riesgo === 2)
const veredictos = await parallel(criticos.map((r) => () =>
  agent(`Revisá el diff de ${r.contrato.id}. Foco: ${r.contrato.objetivo}. ` +
        `Devolvé hallazgos con archivo:línea; no aprobación performativa.`,
        { model: 'opus', effort: 'xhigh', phase: 'Riesgo2', label: `rev:${r.contrato.id}` })
))

// G3 — gate de ola: lo único que caza integración rota entre tareas verdes
phase('GateOla')
const g3 = await agent(
  `Ejecutá: ${args.gateOla}\nDevolvé verde, casosEjecutados y las líneas de falla si hay.`,
  { model: 'haiku', effort: 'low', phase: 'GateOla', label: 'g3', schema: GATE }
)

return {
  aceptados: vivos.length - rechazados.length,
  rechazados: rechazados.map((r) => r.contrato.id),
  criticos: veredictos.filter(Boolean),
  integracion: g3.verde ? 'verde' : 'ROJA',
}
```

## Notas de uso

- **`pipeline` y no `parallel` entre implementación y gates**: no hay dependencia
  cruzada entre tareas, así que una barrera solo agregaría espera. La barrera
  aparece recién en G3, que sí necesita todo el lote junto.
- **La firma final sigue siendo del orquestador.** El workflow devuelve
  `criticos` como **borrador**; el veredicto de riesgo 2 lo firmás vos al leer el
  retorno. Un script no firma.
- **Resume**: si el harness muere a mitad, `Workflow({scriptPath, resumeFromRunId})`
  reusa el prefijo intacto. Editar una etapa invalida esa etapa y las siguientes,
  no las anteriores.
