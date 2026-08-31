# ADR 0001 — El loop orquestador baja a tier obrero; el razonador pasa a firmante invocado

- **Fecha**: 2026-08-28
- **Estado**: aceptado (pendiente de piloto medido)
- **Decide**: protocolo `devstral-orchestration` v3.0 · contrato
  `contracts/orchestration.md` v1.3 · skill `alyp-exec` v1.1.0
- **Consultado**: tier juez (Fable) vía agente `consultor` — veredicto
  "viable-con-recortes", confianza alta en la estructura, **media en la
  proyección de costo**

## Contexto

El sistema v2.10 ponía a Opus como loop orquestador permanente ("Opus orquesta
SIEMPRE"), con Sonnet ejecutando y subagentes Opus reservados a cuatro filas de
razonamiento pesado. El invariante 1 del contrato ya decía que el contexto del
orquestador es el recurso más caro, pero la doctrina no sacaba la consecuencia.

**Medición** sobre `~/.claude/projects/**/*.jsonl`, 95.034 requests únicos
deduplicados por `(requestId, message.id)`, 30-may → 28-ago 2026, separando
`isSidechain` antes de agregar:

| Carril | Costo | % | Requests | Ctx medio |
|---|---:|---:|---:|---:|
| **Opus — loop principal** | **$27.456** | **83,8%** | 47.675 | **267.889** |
| Sonnet — subagentes | $1.889 | 5,8% | 33.555 | 141.892 |
| **Opus — subagentes** | **$1.843** | **5,6%** | 8.942 | 89.817 |
| Fable — loop | $1.320 | 4,0% | 1.593 | 304.069 |

Descomposición del loop Opus: `cache_read` **57,1% del costo total**,
`cache_write` 16,4%, output apenas 10,2%. **No se paga por pensar: se paga por
releer.**

Contrafácticos calculados sobre los mismos tokens:

| Palanca | Ahorro |
|---|---:|
| Mover los subagentes Opus a Sonnet | **4,5%** |
| Bajar el ctx del loop a 200K / 150K / 120K | 18,6% / 32,4% / **40,6%** |
| **Bajar el loop de tier (esta decisión)** | **67% bruto** |

Los subagentes Opus ya corrían acotados a ~90K: no eran el problema. El problema
era el tier del loop, multiplicado por su contexto.

## Decisión

1. **El loop orquestador es de tier obrero (Sonnet).** Rutea, descompone en
   contratos, despacha olas, corre G1–G3 y sintetiza. **No firma.**
2. **El tier razonador (Opus) pasa a firmante invocado**, con contexto fresco y
   paquete acotado, en exactamente tres puntos: **G0** (firma de contratos de
   ola, antes de ejecutar), **diff de riesgo 2** (de a uno, nunca agregado) y
   **veredicto de merge**.
3. **Se crea G0**, el único gate de juicio y el único que corre antes de
   ejecutar. G1–G3 protegen el *resultado* contra el ejecutor; ninguno protege el
   *criterio* contra quien lo escribió. Con un loop obrero, el `verificacion`, la
   allowlist y el `riesgo` los redacta la parte que después se absuelve.
4. **Piso de riesgo mecánico por rutas**: migraciones, auth, RLS, middleware,
   secretos, webhooks y pagos fuerzan riesgo 2 por comando, no por juicio.
5. **El firmante re-ejecuta lo que firma** (G1/G2) en riesgo 2. Un paquete curado
   por el loop orienta la firma; no la funda.

## Recortes (qué NO baja a Sonnet)

| Fila | Resolución |
|---|---|
| Seguridad crítica (auth/RLS/pagos) | Sonnet ejecuta, **Opus firma el diff, de a uno**. No agregable: el modo de falla —la política ausente, el trust boundary que nadie testeó— es invisible para todo gate mecánico |
| Arquitectura detallada | **Baja**, con recorte: Sonnet redacta un ADR, Opus firma 1 página |
| Debugging difícil (race/heisenbug) | **Baja sólo con repro determinista fijado antes** como `verificacion`. Sin repro, la tarea delegable es "producí el repro": un fix de race sin repro pasa G1 por azar |
| Juez adversarial / pre-merge | **No baja** — es el nuevo rol del razonador |

## Alternativas consideradas

- **A · Prohibir los subagentes Opus, loop sigue Opus.** Descartada: ataca el
  5,6% y conserva el 83,8%. Es la opción que el pedido original sugería y la
  medición la desarma.
- **C sola · Validación estratificada por riesgo.** Ya existe (`alyp-exec`
  §7.2). Sin G0 deja el contrato sin juez, que es justo el artefacto que el loop
  obrero produce y del que es parte juzgada.
- **D · Presupuesto de tokens de juicio por ola.** Descartada como cláusula: un
  presupuesto agotable crea el peor acoplamiento posible —saltear la revisión de
  riesgo 2 porque "no quedan tokens". Queda como métrica/alarma, no como gate.

## Consecuencias

**A favor**: el tramo >300K —que concentra el 47,5% del costo— pasa de precio
razonador a precio obrero (~5× menos por token). Menos revisiones: riesgo 0 y 1
cierran por gates sin juicio. G0 se paga por ola o por lote, con el perfil de
contexto barato de los subagentes (~90K), y una ola íntegramente de riesgo 0 no
lo invoca.

**En contra**: aparece una invocación nueva en el camino crítico (G0) antes de
cada ola de riesgo ≥1. Y el juicio del loop sobre la descomposición baja de tier
— es el riesgo real de esta decisión, y G0 es precisamente su mitigación.

**Modos de falla y su señal**:

| Falla | Señal que la caza |
|---|---|
| `verificacion` flojo → gates huecos ("todo verde, producto equivocado") | G0 (primaria); tasa de bugs en verificación de browser (tardía) |
| Riesgo subclasificado (2 etiquetado como 1) | Piso mecánico por rutas + G0 |
| Deriva del plan entre olas | El firmante coteja `estado.md` contra el plan — líneas, no código |
| Opus-firmante como sello de goma | Re-ejecuta G1/G2 de lo que firma; alarma de G0 que nunca devuelve `corregir` |
| El costo fijo de G0 se come el ahorro en olas chicas | Ola de riesgo 0 no invoca G0; G0 por lote |

## Reversibilidad

**Dos vías, un commit**: `orquestador:` vuelve a `claude-opus-4-8` en
`capacity.yaml`, y el protocolo se revierte desde
`skills/devstral-orchestration/versions/v2.9/`.

**Condición de reversión pre-acordada**: si en las primeras olas sube de forma
sostenida la tasa de bugs post-merge o los ❌ de G3, se vuelve a Opus-loop.

## Pendiente (lo que esta decisión NO demuestra)

Fable declaró confianza **media en la proyección de costo** y pidió el artefacto
que falta: **una corrida de `~/.claude/scripts/token-audit.sh` sobre un plan
piloto con loop Sonnet**, para medir la altura de compactación y el perfil real
de contexto de ese loop antes de declarar el ahorro. Los contrafácticos de arriba
asumen los mismos tokens a otro precio; un loop Sonnet podría necesitar más
turnos, y eso no está medido.

**El ahorro proyectado es una hipótesis con aritmética sólida, no un resultado.**
