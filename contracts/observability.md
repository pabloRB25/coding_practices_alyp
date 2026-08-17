# Contrato: observability (v1)

Invariantes de la capa de observabilidad, agnósticos de stack y de backend. El
"cómo" vive en un perfil (hoy: `skills/alyp-observability/`).
Prueba de fuego: si una regla nombra un producto, pertenece al perfil, no acá.

**Composición**: este contrato se apoya en `contracts/logging-standard.md` y no
lo reescribe. El logging define *qué se escribe* (JSON estructurado, claves
congeladas, `traceid-contract`); este contrato define *cómo llega y se consulta*
(transporte, instrumentación, configuración por ambiente).

**Sin sello propio en el doc del agente** — a diferencia de code/logging/qa, la
conformidad de este estándar vive en parte **fuera del repo** (configuración de
plataforma: destinos, credenciales, drains). Un sello en el repo atestiguaría
algo que el repo no controla. La adopción se declara en `standards.yaml`
(`observability: v1`) y se audita contra la plataforma, no contra un grep.

## Invariantes (O1–O6)

- **O1 — Instrumentación única con estándares abiertos.** La app se instrumenta
  UNA vez contra un estándar abierto. El backend de destino es decisión de
  proyecto, nunca del código: cambiar de backend es cambiar configuración, con
  cero cambios de código.
- **O2 — La app no persiste; la plataforma transporta.** La app solo escribe a
  stdout/stderr (regla 3 del logging-standard). La persistencia la provee un
  transporte de plataforma configurado por ambiente. Un ambiente con filesystem
  efímero y sin transporte declarado **pierde todo lo que la app escribió** —
  escribir a archivo local no es una estrategia de persistencia.
- **O3 — Degradación a no-op.** Sin destino configurado, la instrumentación
  corre en no-op: sin overhead y sin errores. Instrumentar nunca puede romper la
  app ni volver obligatorio tener backend para correr o testear.
- **O4 — Identidad compartida.** Traces y métricas comparten el `traceId` que
  congela el logging-standard (`traceid-contract`). Una corrida se sigue de log
  a traza sin correlación manual ni identificadores paralelos.
- **O5 — Configuración por ambiente, declarada.** Cada ambiente declara su
  destino y su nivel de detalle, y el mapa `ambiente → destino → nivel` vive en
  el doc del agente. Un ambiente sin destino declarado es un incumplimiento, no
  un default. El nivel se ajusta por ambiente para acotar ruido y costo.
- **O6 — Verificable de punta a punta.** Existe una prueba que provoca un error
  real en un ambiente desplegado y lo recupera desde el backend con su ubicación
  de código, dentro de un presupuesto de tiempo declarado. Sin esa prueba, la
  observabilidad está *configurada* pero no *verificada*.

## Aceptación agnóstica (para cualquier perfil)

1. Un error provocado en un ambiente desplegado aparece en el backend con su
   `traceId` y su ubicación de código, dentro del presupuesto declarado.
2. Quitar la configuración de destino deja la app corriendo y sus tests en
   verde: el no-op es verificable, no declarativo.
3. El diff de un cambio de backend contiene solo configuración — ningún archivo
   de código de la app.
4. El mapa `ambiente → destino → nivel` está documentado en el doc del agente y
   coincide con lo efectivamente configurado en la plataforma.
5. El `traceId` de una traza y el de sus logs son el mismo valor.

## Perfiles

| Perfil | Implementación |
|---|---|
| next·vercel | `skills/alyp-observability/` (OTel vía `instrumentation.ts`, Vercel Log Drains, exporters OTLP; perfil Grafana/Loki documentado) |
