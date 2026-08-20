# Contrato del spec de flujo — qa-standard: v1

Cada archivo `qa/flujos/<dominio>/<flujo>.yaml` describe UN flujo de negocio.
Es la única fuente de verdad: Playwright lo implementa (spec con el mismo `id`),
el smoke agéntico lo ejecuta literalmente.

## Campos

| Campo | Obligatorio | Regla |
|---|---|---|
| `id` | sí | `dominio.entidad.accion`, único en el catálogo, kebab/camel prohibidos (usar puntos) |
| `criticidad` | sí | `P0` (smoke + CI), `P1` (CI), `P2` (nocturno) |
| `actores` | sí | referencias a `qa/seeds/personas.yaml` |
| `precondiciones` | sí | bloques de seed nombrados y/o frases verificables |
| `pasos` | sí | lenguaje de negocio, imperativo. PROHIBIDO: selectores CSS, data-testid, URLs internas |
| `aserciones.ui` | sí | qué debe ver el usuario, verificable a ojo |
| `aserciones.db` | sí (si el flujo persiste) | lista de `{nombre, query, espera}`; SQL parametrizado con `:params` |
| `aserciones.logs` | sí | por defecto: "cero logs nivel error con el traceId de la corrida" |
| `ambientes_permitidos` | sí | subconjunto de los ambientes del config; si el flujo ESCRIBE, solo ambientes con `permite_reset: namespace` (nunca `prod` ni pre-producción) |
| `bugs_cubiertos` | no | ids/commits de bugs pasados que este flujo re-verifica (regresión con memoria) |
| `depende_de` | no | `id` de otro flujo cuyo estado final necesita este flujo (ver "Dependencias entre flujos") |

## Ejemplo canónico

```yaml
id: planillas.semanal.aprobar
criticidad: P0
actores: [admin-empresa]
precondiciones:
  - seed: empresa-base
  - "empresa con 3 empleados activos, modalidad semanal"
pasos:
  - "Ir a Planillas → Nueva planilla semanal"
  - "Seleccionar la semana en curso"
  - "Verificar que cada empleado muestra salario y deducciones calculadas"
  - "Aprobar la planilla"
aserciones:
  ui:
    - "Estado visible = 'Aprobada'"
    - "Ningún monto muestra NaN, undefined o negativo inesperado"
  db:
    - nombre: planilla_persistida
      query: "select estado, total from planillas where periodo = :periodo"
      espera: { estado: aprobada, total: "> 0" }
  logs:
    - "cero logs nivel error con el traceId de la corrida"
ambientes_permitidos: [dev, preview, staging]
bugs_cubiertos: []
```

## Regla del campo `espera`

`espera` acepta literales simples (`estado: aprobada`) y comparaciones en string
(`total: "> 0"`). Las expectativas que son CÁLCULO de negocio (ej. `iva =
subtotal × 13%`) se declaran acá en lenguaje de negocio (`iva: "13% del
subtotal"`) y la verificación numérica exacta vive en el spec de Playwright
(`toBeCloseTo`). El YAML dice QUÉ debe cumplirse; el código dice CÓMO se verifica.

## Mapeo a Playwright

1 spec por YAML: archivo `qa/e2e/flujos/<id>.spec.ts` (id literal, con puntos),
`describe` titulado con el id + tag `@<criticidad>`. Referencia canónica:
`templates/e2e/flujos/ejemplo.spec.ts` del skill.

## Dependencias entre flujos

Los specs corren en paralelo y sin orden garantizado. Si un flujo necesita
estado que deja otro (ej. "ver colilla" necesita un período aprobado), en orden
de preferencia: (1) **seed de estado avanzado** — un bloque de seed que inserta
directamente el estado final del flujo previo (un período ya aprobado), la
opción más robusta; (2) declarar `depende_de: <id>` y encadenarlos con
`dependencies` de projects de Playwright o `test.describe.serial`. Nunca
confíes en el orden implícito de ejecución; si ninguna opción aplica todavía,
`test.fixme()` con el motivo.

## Reglas de redacción de pasos

- Escribí para un humano que no vio el código: "Aprobar la planilla", no
  "click en #btn-aprobar".
- Un paso = una acción u observación. Los cálculos esperados van en aserciones.
- Si un paso necesita datos concretos (montos, fechas), definí el dato en la
  precondición/seed y referencialo por nombre.
