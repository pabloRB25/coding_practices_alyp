# Contrato: qa-standard (v1.1) — sello `qa-standard: v1`

Pruebas automatizadas de flujos de negocio, agnósticas de stack. El "cómo"
(Playwright, seeds SQL, pgTAP) vive en el perfil `skills/alyp-qa-standard/`.

## Principios (P1–P7)

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
- **P7 — Reset acotado a un namespace.** El reset de P2 borra exclusivamente el
  espacio de nombres propio de QA (tenant, prefijo o marca declarada), nunca por
  tabla completa. Con esa cota, reset+seed es lícito contra el ambiente de
  desarrollo aunque comparta base con datos reales. Pre-producción y producción
  no reciben escrituras de QA (P6).

## Criticidades

P0 = gate de promoción a pre-producción + gate a producción · P1 = gate de
promoción a pre-producción · P2 = nocturno + exploratorio agéntico. Presupuestos
(minutos CI / tokens) declarados en el config.

## Promoción entre ambientes

Qué corre en cada frontera, y por qué esa y no otra.

- **G1 — Tres gates, no uno.** Todo repo define tres puntos de validación: el
  **local** (antes de publicar el cambio), el de **promoción a pre-producción** y
  el de **promoción a producción**. Cada uno declara qué set corre y con qué
  nombre.
- **G2 — El gate local corre el mismo set que el de pre-producción.** El local
  existe para adelantar el fallo, no para validar menos. Redactado como parte de
  I2 en `contracts/code-standard.md`; acá es puntero.
- **G3 — Todo gate de promoción es bloqueante.** Un gate que no impide la
  promoción no es un gate: es telemetría. Si el mecanismo de bloqueo no puede
  hacerse cumplir en una rama, esa rama no es una frontera de promoción.
- **G4 — El nombre del gate es un identificador estable.** El mecanismo de
  bloqueo referencia al gate por nombre: renombrar el trabajo sin renombrar la
  referencia deja el gate mudo — pasa a "no reporta nunca", que no es lo mismo
  que "pasa". Cambiar el nombre es cambiar el contrato de bloqueo.
- **G5 — El gate a producción valida el ambiente, no re-valida el código.** El
  código ya pasó el gate de pre-producción y no cambió; lo que cambió es el
  entorno (datos, configuración, esquema aplicado). Se prueba con los flujos P0
  contra el despliegue real, no repitiendo la suíte.

## Aceptación agnóstica (para cualquier perfil)

1. Los tres gates existen, están declarados y cada uno tiene un nombre estable.
2. Un cambio que rompe un flujo de criticidad bloqueante **no se puede promover**
   a pre-producción: el intento queda bloqueado, no solo registrado.
3. Renombrar el gate sin actualizar la referencia del mecanismo de bloqueo
   falla de forma visible, no silenciosa.
4. El reset corre contra desarrollo sin tocar datos ajenos al namespace de QA,
   y es rechazado contra pre-producción y producción.

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

## Enmiendas

- **v1.1 (2026-08-19)** — Se suma P7 (reset acotado a namespace) y la sección
  §Promoción entre ambientes con G1, G3, G4 y G5; la tabla de criticidades pasa
  a nombrar gates en vez de "CI en cada PR". Motivo: la auditoría de la flota
  encontró promociones a pre-producción con el gate en rojo, un gate requerido
  cuyo nombre no coincidía con el del trabajo que lo reporta (quedaba mudo, no
  rojo), y una prohibición de reset en desarrollo que impedía correr los flujos
  donde se los necesita. Diseño:
  `docs/specs/2026-08-19-modelo-3-gates-design.md`.
