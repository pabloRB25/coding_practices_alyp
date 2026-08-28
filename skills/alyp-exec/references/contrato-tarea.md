# Contrato de Tarea (ida)

Lo escribe el orquestador. Es lo único que recibe el ejecutor: si el contrato no
alcanza para trabajar, la tarea no estaba lista para despacharse.

## Plantilla

```
## Tarea <id>
objetivo:      <una frase verificable, no cualitativa>
nivel:         opus | sonnet | haiku
riesgo:        0 | 1 | 2        # ≥1 exige firma G0 antes de despachar
archivos:      <allowlist explícita — NO tocar nada fuera de esta lista>
contratos:     <firmas, tipos e interfaces PEGADAS acá, no referenciadas>
verificacion:  <comando literal>
               # criterio: exit 0 Y >0 casos ejecutados
prohibido:     <lo que no debe tocar ni asumir>
presupuesto:   <máx. intentos propios antes de devolver ❌; default 2>
```

## Reglas de llenado

### `objetivo` — verificable, nunca cualitativa

❌ "mejorar el manejo de errores del endpoint"
✅ "`POST /api/reservas` devuelve 422 con `codigo: RESERVA_FECHA_INVALIDA` cuando
`fecha_entrada >= fecha_salida`"

Si no podés escribir el objetivo de forma que un tercero decida sin opinar si se
cumplió, todavía no es una tarea: es un deseo.

### `contratos` — pegado, no referenciado

Es la palanca de ahorro principal del lado de la ida. El ejecutor recibe el
contexto pre-masticado y **no gasta 15 tool calls descubriendo una firma**.

Ese material lo junta **un** `explorador` **una vez por ola** (F1) y se reusa en
las N tareas: exploración pagada una vez, no N veces.

Pegá: firmas de las funciones que va a llamar, tipos que debe respetar, el patrón
del módulo vecino que debe imitar, y el path exacto de los archivos relevantes.
No pegues archivos enteros.

### `archivos` — allowlist, y excluye los tests

Dos propiedades, ambas duras:

1. **Es una allowlist, no una sugerencia.** El gate G2 compara
   `git diff --name-only` contra esta lista; cualquier archivo fuera es `❌`
   automático, sin juicio.
2. **Excluye los archivos de test y de verificación**, salvo que la tarea *sea*
   producirlos. Si el ejecutor puede modificar el test que lo mide, la medición
   no vale — es la puerta abierta al reward-hacking (debilitar el test hasta que
   pase). Contrato `orchestration` invariante 7(b).

Cuando la tarea SÍ es escribir tests, el criterio de `verificacion` no puede ser
"los tests pasan" (trivial de satisfacer): tiene que ser "los tests pasan **y**
fallan contra la implementación rota" — o el test se escribe primero, en rojo,
por quien implementa (TDD), y esta tarea solo agrega cobertura mecánica.

### `verificacion` — literal, y con guarda de vacío

El comando se pega tal cual se va a correr. Sirve para tres cosas a la vez: el
ejecutor lo corre en F3, vos lo re-ejecutás en G1, y su **anterioridad** al
trabajo es lo que vuelve falsable el veredicto.

> **Guarda obligatoria**: exit 0 no alcanza. Un comando que matchea 0 casos sale
> 0 y no probó nada. El criterio siempre es **exit 0 Y >0 casos ejecutados**. Ver
> `references/gates.md` para las formas concretas por runner.

### `riesgo` — decide cuánto juicio se le aplica al resultado

| Nivel | Cuándo |
|---|---|
| **0** | Mecánico y aislado: codemod, scaffold, formato, JSDoc, cobertura adicional. |
| **1** | Todo lo normal: lógica de negocio, endpoints, componentes, refactors. |
| **2** | auth, sesión/JWT, RLS, secretos, pagos, PII, migraciones, borrados, cualquier cosa irreversible. |

Ante duda, subí uno. El costo de un error supera el ahorro.

**No lo decide solo tu juicio.** Dos mecanismos lo acotan, porque el riesgo es
la palanca que decide cuánta revisión recibe el cambio — y el loop que la asigna
es también el que se beneficia de asignarla baja:

1. **Piso mecánico por rutas** (`references/gates.md` §G0): si la allowlist toca
   migraciones, auth, RLS, middleware, secretos, webhooks o pagos, el riesgo es
   **2 automático**. Es un comando sobre la allowlist, no una apreciación.
2. **Firma G0**: todo contrato de riesgo ≥1 lo firma el tier razonador invocado
   **antes** de despacharse la ola. Puede devolver `subir riesgo a N`.

Contrato `orchestration` invariante 8.

## Ejemplo completo

```
## Tarea T-03
objetivo:      `listarReservasPorHuesped(huespedId)` devuelve solo reservas del
               huésped y excluye las canceladas, ordenadas por fecha_entrada asc
nivel:         sonnet
riesgo:        1
archivos:      src/features/reservas/queries.ts
               src/features/reservas/index.ts
contratos:     type Reserva = { id: string; huespedId: string; fechaEntrada: Date;
                                estado: 'confirmada' | 'cancelada' | 'completada' }
               // patrón a imitar: src/features/huespedes/queries.ts:14-38
               // cliente db: import { db } from '@/lib/db'  → db.query.reservas
               // el barrel exporta named, nunca default
verificacion:  pnpm vitest run src/features/reservas/queries.test.ts --reporter=verbose
prohibido:     tocar el schema de Drizzle; agregar dependencias; modificar tests
presupuesto:   2
```
