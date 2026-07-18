# Contrato: qa-standard (v1) — sello `qa-standard: v1`

Pruebas automatizadas de flujos de negocio, agnósticas de stack. El "cómo"
(Playwright, seeds SQL, pgTAP) vive en el perfil `skills/alyp-qa-standard/`.

## Principios (P1–P6)

- **P1 — Catálogo declarativo único.** Los flujos de negocio se describen UNA vez,
  en lenguaje de negocio (nunca selectores/detalles de UI), en un catálogo
  declarativo. El runner determinista lo implementa; los agentes lo interpretan.
- **P2 — Estado conocido.** Toda corrida parte de reset + seed idempotentes
  (correr 2 veces = mismo estado). Jamás se trunca identidad/autenticación.
- **P3 — Tres oráculos.** Un flujo pasa solo si pasan UI + persistencia + logs
  (cero errores para el trace de la corrida — consume el traceid-contract del
  logging-standard). Assert solo de UI = el test miente.
- **P4 — Veredicto por corrida.** Toda corrida deja un veredicto estructurado
  (instancia de `contracts/evidencia.schema.json`) + artefactos. *Nota de conformidad:* P4 define el objetivo del contrato; el estado actual de cada perfil se declara en su skill — hoy el `veredicto.json` del perfil next·supabase·vercel se transporta dentro del sobre (campo `detalle`), no es instancia directa.
- **P5 — Determinista para regresión, agéntico para interpretación.** El agente
  ejecuta el catálogo (no improvisa cobertura) y nunca reemplaza al runner en CI.
- **P6 — PROD es solo-lectura.** Los flujos declaran ambientes permitidos; el
  ambiente productivo jamás recibe escrituras de QA.

## Criticidades

P0 = CI en cada PR + smoke post-deploy · P1 = CI en cada PR · P2 = nocturno +
exploratorio agéntico. Presupuestos (minutos CI / tokens) declarados en el config.

## Perfiles

| Perfil | Implementación |
|---|---|
| next·supabase·vercel | `skills/alyp-qa-standard/` (YAML + Playwright + oráculo DB Supabase + smoke.md) |

## Definición canónica de evidencia

Única redacción normativa (las demás menciones en skills/CLAUDE.md son punteros):

Una tarea tiene **evidencia reproducible** cuando cumple lo que aplique:
1. **Lógica**: test co-localizado verde que cubre el happy path del cambio.
2. **Runtime de client** (server actions, hidratación, RLS silencioso):
   verificación en browser real — status 200 en las requests del flujo +
   consola limpia (cero errores) + screenshot; o el `log.warn` de resultado
   vacío disparándose donde corresponde.
3. **Flujo de negocio**: corrida del catálogo con sus TRES oráculos
   (UI + DB + logs por `traceId`) y `veredicto.json` en `qa/evidencias/`.

El transporte de evidencia entre agentes usa `contracts/evidencia.schema.json`.
