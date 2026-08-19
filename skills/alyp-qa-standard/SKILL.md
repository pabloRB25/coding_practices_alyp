---
name: alyp-qa-standard
version: 1.0.0
provides: [qa-standard]
requires: [traceid-contract]
description: Usar cuando el usuario pida instalar o auditar el estándar de pruebas de Alyp (sello qa-standard v1), scaffoldear la carpeta qa/ en un proyecto, crear o mantener el catálogo de flujos de negocio en YAML, configurar Playwright E2E con oráculos UI+DB+logs, montar el smoke agéntico post-deploy, agregar pruebas de RLS con pgTAP, o mencione "qa-standard", "catálogo de flujos", "veredicto.json", "smoke agéntico" o "pruebas automatizadas de flujos de negocio".
---

# Estándar de pruebas Alyp — `qa-standard: v1`

Estándar portable de pruebas automatizadas sobre flujos de negocio. Complementa
`alyp-agentic-standards` (código) y `agentic-logging` (logs): cierra el ciclo
LEER → ENTENDER → CAMBIAR → **VERIFICAR** con evidencia reproducible.

**Contrato**: perfil next·supabase·vercel de `contracts/qa-standard.md` (P1–P6).
El `veredicto.json` se transporta en el sobre `contracts/evidencia.schema.json`
(dentro de `detalle`, tipo `e2e`) — su schema propio (`templates/veredicto.schema.json`,
array de flujos) es estructuralmente distinto al sobre y no es una instancia directa.

## Principios (los 6, no negociables)

1. **El catálogo de flujos (`qa/flujos/*.yaml`) es la única fuente de verdad.**
   Playwright lo *implementa*, los agentes lo *interpretan*. Nunca dupliques la
   descripción de un flujo fuera del catálogo.
2. **Toda corrida parte de estado conocido**: reset + seed idempotente.
3. **Un flujo pasa solo si pasan sus TRES oráculos**: UI + DB + logs
   (consola limpia y cero logs `error` para el `traceId` de la corrida).
4. **Toda corrida deja `veredicto.json`** (schema en `templates/veredicto.schema.json`)
   + screenshots/traces en `qa/evidencias/<run-id>/`.
5. **Determinista para regresión, agéntico para interpretación.** El agente
   nunca reemplaza a Playwright en CI.
6. **Jamás escribir en PROD.** `qa.config.yaml` marca prod `solo_lectura: true`;
   los flujos declaran `ambientes_permitidos`.

## Cuándo NO usar

- Proyectos sin UI ni flujos de negocio (librerías, scripts) → alcanza vitest.
- Para redactar tests unitarios del dominio → eso es capa 1, va con el código.

## Estructura objetivo

```
qa/
├── qa.config.yaml          # manifiesto (ambientes, oráculos, presupuestos)
├── flujos/                 # ⭐ catálogo declarativo + _schema.md
├── seeds/                  # reset + seed idempotentes + personas.yaml
├── e2e/                    # Playwright: config, soporte/ (oráculos), flujos/
├── agentic/                # smoke.md (prompt-contrato del agente)
├── evidencias/             # (gitignored) veredicto.json + screenshots
└── informes/               # agregados históricos (opcional)
```

## Instalación (orden estricto)

1. Copiá `templates/` → `qa/` del repo respetando la estructura de arriba
   (los templates de este skill son la referencia canónica, adaptá placeholders).
2. Completá `qa/qa.config.yaml` con ambientes reales. Verificá dos veces:
   prod `solo_lectura: true`, staging `permite_reset: ninguno`, desarrollo
   `permite_reset: namespace`, credenciales SOLO por env vars, nunca en el repo.
3. Escribí el catálogo: los 3–5 flujos P0 primero, contra `flujos/_schema.md`.
   Pasos en lenguaje de negocio, NUNCA selectores.
4. Seeds: `reset` + `seed` idempotentes (correr 2 veces = mismo estado) y
   `personas.yaml`. El reset borra SOLO el namespace QA —tenant, prefijo o marca
   declarada— con filtro explícito en cada DELETE/UPDATE (P7): nunca `TRUNCATE`,
   nunca un `DELETE` sin `WHERE`, jamás `auth.users`. Así es lícito correrlo
   contra la base de desarrollo aunque tenga datos reales conviviendo.
5. E2E: registrá `qa` como paquete del workspace (`pnpm-workspace.yaml`:
   `- qa`), copiá `templates/package.json` (declara deps y los scripts
   `seed`/`e2e` que usa el CI) y `e2e/` (config + `soporte/`). 1 spec por YAML
   del catálogo: naming, tags y mapeo según `templates/e2e/flujos/ejemplo.spec.ts`.
6. Smoke agéntico: `agentic/smoke.md` tal cual (es un contrato, no editarlo por proyecto;
   lo variable vive en `qa.config.yaml`).
7. CI: copiá `templates/ci/qa-e2e.yml` y `templates/ci/smoke.yml` →
   `.github/workflows/`. Son **reutilizables** (`workflow_call`): no disparan
   solos, los invocan los gates de promoción (`gate-stg.yml` / `gate-main.yml`
   del skill `alyp-new-project`). Esto es lo que hace que los flujos cuenten
   dentro del check requerido de la rama — un workflow que dispara por su cuenta
   no bloquea la promoción, y un gate que no bloquea es telemetría (G3).
   Respetá el presupuesto de minutos del config (falla el job si lo excede).
8. Agregá `qa/evidencias/` al `.gitignore` y el sello `qa-standard: v1` al
   CLAUDE.md del proyecto (creá ambos archivos con contenido mínimo si no existen).

## Criticidades y ventanas

| Criticidad | Dónde corre | Presupuesto |
|---|---|---|
| P0 | Gate STG (develop→staging) + Gate MAIN (smoke solo-lectura) + smoke agéntico post-deploy | CI ≤ presupuesto del config |
| P1 | Gate STG | ídem |
| P2 | Nocturno (cron) + exploratorio agéntico | tokens del config |

Los P0 que corren en el Gate MAIN van contra el deploy real de staging **sin
reset ni seed**: tienen que ser no destructivos (P6/P7).

## Errores comunes

- Selectores CSS en el YAML del catálogo → va en el spec de Playwright, no en el contrato.
- Seeds no idempotentes ("ya existe" al correr 2 veces) → usar upserts/`on conflict`.
- Asserts solo de UI → sin oráculo DB el test miente (calculado ≠ persistido).
- Smoke agéntico que "explora" → debe ejecutar el catálogo, no improvisar cobertura.
- Correr contra prod con service role → el config lo prohíbe; auditalo primero.

## Auditoría de adopción (proyecto existente)

Verificá en orden: existe `qa/qa.config.yaml` con el sello → catálogo valida
contra `_schema.md` → cada flujo P0/P1 tiene spec e2e con su mismo `id` →
seeds idempotentes → workflow CI activo → última corrida dejó `veredicto.json`
válido. Lo que falte, instalalo con los pasos de arriba.
