# Contrato: code-standard (v1) — sello `agentic-standard: v1`

Invariantes del código "agentic-ready", agnósticos de stack. El "cómo" vive en un
perfil (hoy: `skills/alyp-agentic-standards/` = perfil next·supabase·vercel).
Prueba de fuego: si una regla nombra un producto, pertenece al perfil, no acá.

## Invariantes (I1–I9)

- **I1 — Ciclo del agente.** Todo optimiza LEER → ENTENDER → CAMBIAR → VERIFICAR:
  lo que abarata un paso del ciclo sube la tasa de éxito y baja el costo.
- **I2 — Gate único determinista.** Existe UN comando de verificación (typecheck +
  lint + tests) que el agente corre tras cada cambio, espejado exactamente en CI.
- **I3 — Done = gate + evidencia.** Una tarea está terminada solo con el gate verde
  Y evidencia reproducible del happy path (test que cubre la lógica, o evidencia de
  runtime real). "Parece correcto" = no-evaluable, nunca positivo.
- **I4 — Co-localización por dominio.** El código se agrupa por dominio de negocio
  con naming uniforme y predecible (`<dominio>.<rol>.<ext>`), no por capa técnica.
- **I5 — Contratos de datos con derivación.** Los tipos SE DERIVAN de un schema
  validable en runtime (única fuente de verdad); toda entrada externa se valida
  con parse seguro y código de error UPPER_SNAKE.
- **I6 — Fronteras de módulo.** Cada dominio expone una API pública explícita
  (barrel); los imports profundos entre dominios están prohibidos y el linter lo
  hace cumplir.
- **I7 — Archivos chicos.** < 200 líneas por archivo; si crece, se divide por
  responsabilidad.
- **I8 — Errores estructurados.** Ningún catch vacío; todo error se registra vía el
  logging-standard (ver `contracts/logging-standard.md`). Sin logging no estructurado.
- **I9 — Generación sobre repetición.** Crear un dominio nuevo es UN comando que
  scaffoldea la estructura completa (archivos + stub de migración + runbook).
- **I10 — Índice de dominios derivado.** El repo mantiene un índice navegable de
  sus dominios —nombre, ubicación y API pública— **generado desde el código**,
  nunca escrito a mano, en el documento que el agente lee primero. Regenerarlo
  no produce diff: si lo produce, el índice está desactualizado y el gate falla.
  I4 hace *predecible* dónde está cada dominio; I10 hace *enumerable* cuáles hay.

## Aceptación agnóstica (para cualquier perfil)

1. El gate único existe, pasa limpio y CI ejecuta exactamente el mismo comando.
2. El generador crea un dominio completo en un comando.
3. Un import profundo entre dominios falla el lint; el import por barrel pasa.
4. El repo lleva el sello `agentic-standard: v1` en su doc de agente y el
   manifiesto `standards.yaml` lo declara.
5. El índice de dominios está poblado y regenerarlo no produce diff; un dominio
   nuevo sin regenerar el índice deja el gate en rojo.

## Perfiles

| Perfil | Implementación |
|---|---|
| next·supabase·vercel | `skills/alyp-agentic-standards/` (pnpm verify, Zod, ESLint no-restricted-imports, new-feature.mjs, Vitest, RLS) |
