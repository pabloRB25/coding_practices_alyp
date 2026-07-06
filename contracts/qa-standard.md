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
  (instancia de `contracts/evidencia.schema.json`) + artefactos.
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
