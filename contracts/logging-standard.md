# Contrato: logging-standard (v1) — sello `logging-standard: v1`

## Las 3 reglas de oro (agnósticas)

1. **Nada de errores en texto plano** — todo error es JSON estructurado con
   `traceId`, `contexto` y objeto `error`.
2. **Honeypot** — la ubicación registrada es la primera línea de TU código,
   nunca de dependencias/framework.
3. **Salida agnóstica** — la app solo escribe a stdout/stderr; la persistencia
   es de la plataforma (drain/collector), configurada por env vars.

## Schema v1 (claves CONGELADAS)

Las claves del JSON están en **español por decisión de estándar Alyp** y son un
contrato consumido por el extractor (`agent-gps`) y por el oráculo de logs del
qa-standard. Cambiar una clave = versión mayor del contrato con período de alias.

Claves de primer nivel: `nivel`, `servicio`, `env`, `release`, `timestamp`,
`traceId`, `contexto`, `metadata`, `error`.
Claves de `error`: `mensaje`, `codigo` (UPPER_SNAKE), `ubicacion_exacta`,
`archivo`, `linea`, `columna`, `funcion`, `stack_snippet`.

## traceid-contract (lo que otros estándares consumen)

- Todo error de una corrida/request comparte un `traceId` consultable.
- Dado un `traceId`, el extractor devuelve `archivo` + `linea` + `motivo`
  (navegación directa: un archivo, una línea, un fix).
- El oráculo de logs de QA: "cero entradas `nivel: error` para el `traceId`
  de la corrida" es verificable mecánicamente.

## Aceptación agnóstica

1. Un error lanzado produce UNA línea JSON en stderr con `traceId` y ubicación
   apuntando a código propio.
2. El extractor navega de `traceId` a ubicación sin acceso al código fuente.
3. El linter del proyecto falla ante logging no estructurado y catch vacío.

## Perfiles

| Perfil | Implementación |
|---|---|
| Node/TS (cualquier framework) | `skills/agentic-logging/` (assets verbatim, cero deps) |
