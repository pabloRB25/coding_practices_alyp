# FASE 5.5 — Observabilidad (delegado)

**Objetivo**: el proyecto nace con la capa de observabilidad estándar de Alyp instalada:
logging agéntico completo (delegado a `agentic-logging`), instrumentación OpenTelemetry
(traces + métricas) y exporters agnósticos de backend.

**Delega a**: skill `alyp-observability` (que a su vez invoca `agentic-logging` completo).

> Nota: el `instrumentation.ts` creado en FASE 3 sirve como base sobre la que
> `alyp-observability` termina de configurar OTel; las env vars `OTEL_EXPORTER_*`
> definidas ahí quedan cableadas por este skill.

**Gate — no avances si falla**: checklist del skill cumplido; error de prueba en
staging visible en el backend de logs en < 30 s con `traceId`, `archivo` y `linea`.
