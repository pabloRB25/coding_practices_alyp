# Diseño: modelo de 3 gates de promoción

**Fecha**: 2026-08-19 · **Estado**: aprobado en conversación, pendiente de implementación en la flota

## Problema

La auditoría del 2026-08-19 sobre los 17 repos de la flota encontró que el gate
que separa `develop` de `staging` está bien diseñado en el papel y bien
implementado en su capa mecánica, pero **no bloquea**. Hallazgos verificados:

1. **Se mergea a staging con el gate en rojo.** `alyp-rrhh-saas-v2` es el repo
   que más usa el flujo (15 PRs mergeados a `staging`) y esa rama no exige
   ningún status check. El PR #110 (2026-06-24) se mergeó con
   `Build, Lint & Typecheck [fail]`, `Logging Standards Audit [fail]` y
   `guard [fail]`. El CI corre, falla y no impide nada.
2. **Check fantasma.** `global-suministros` exige en `staging` el contexto
   `Build, Lint & Typecheck`, pero su `ci.yml` publica el job como `Verify`.
   El contexto requerido no puede reportar nunca. Hay cuatro nombres distintos
   de gate en la flota (`Build, Lint & Typecheck`, `Verify`,
   `Gate verify (…)`, `Build · Lint · Typecheck`).
3. **La capa de QA de flujos está apagada en toda la flota.** Tres repos tienen
   catálogo (global-suministros 16 flujos, nomi_v3 7, rrhh 7) y ningún repo
   tiene cargados los secrets `QA_*`, así que los jobs quedan *skipped*.
   Los oráculos de DB y de logs no se ejercen nunca.
4. **`develop` sin gate.** En 9 repos el CI solo dispara en PR a `main` y
   `staging`; `develop` no tiene protección en ningún repo.
5. **Las migraciones no se validan desde cero** en ninguna parte hasta PROD.

## Decisiones tomadas

| # | Decisión | Elegido |
|---|---|---|
| D1 | Base de datos del gate local | Supabase **DEV** remoto, namespace QA |
| D2 | Rol de Docker (`supabase start`) | **Opcional siempre**, elección del dev |
| D3 | Set por gate | **Escalonado**: completo en dev→stg, de ambiente en stg→main |
| D4 | Ambiente de los E2E automáticos | **DEV** para el gate de staging; staging real para el gate de main |
| D5 | Hogar de los invariantes | **Enmendar** code-standard y qa-standard (sin contrato ni sello nuevo) |

D2 abre un hueco: si nadie está obligado a Docker, las migraciones podrían no
probarse nunca desde cero. Se mitiga en CI (ver G-STG), no exigiendo Docker.

## Modelo

| | **G-LOCAL** | **G-STG** (PR develop→staging) | **G-MAIN** (PR staging→main) |
|---|---|---|---|
| Dispara | a mano / pre-push | automático al abrir el PR | automático al abrir el PR |
| Valida | typecheck · lint · tests · build · E2E P0+P1 con los 3 oráculos | lo mismo + audit + esquema desde vacío | verify · build · smoke P0 contra el deploy de staging |
| Contra | Supabase DEV, namespace QA | Supabase DEV, namespace QA | ambiente staging desplegado |
| Bloquea | no | **sí** | **sí** |
| Costo | ~6-8 min | ~12-15 min | ~5 min |

G-LOCAL y G-STG corren deliberadamente **el mismo set**: el local existe para
adelantar el fallo de 15 minutos en CI a 6 en la máquina, no para validar menos.
Un gate que depende de que alguien se acuerde de correrlo no es un gate, por eso
G-STG lo repite y sí bloquea.

G-MAIN no repite la suíte porque el código no cambió desde G-STG. Lo que cambia
al promover a producción es el **ambiente**: datos, variables, esquema aplicado.
Eso se prueba con smoke contra el deploy real, no re-corriendo tests unitarios.

## Partición agnóstico / perfil

Prueba de fuego del ecosistema: *si una regla nombra un producto, pertenece al
perfil, no al contrato*.

### Agnóstico → contratos

- **G1 — Tres gates, no uno.** Todo repo define tres puntos de validación:
  local, promoción a pre-producción y promoción a producción. Cada uno declara
  su set y su nombre.
- **G2 — El gate local y el de pre-producción corren el mismo set.** Si
  difieren, el local miente.
- **G3 — Todo gate de promoción es bloqueante.** Un gate que no impide la
  promoción no es un gate: es telemetría.
- **G4 — El nombre del gate es un identificador estable.** El mecanismo de
  bloqueo lo referencia por nombre; renombrar el trabajo sin renombrar la
  referencia deja el gate mudo.
- **G5 — El gate a producción valida el ambiente, no re-valida el código.**
- **G6 — El esquema se valida desde vacío en cada promoción a pre-producción.**
  Aplicarlo sobre una base que ya lo tiene no prueba nada.
- **G7 — El reset de datos de prueba se acota a un espacio de nombres propio.**
  Habilitado en desarrollo; pre-producción y producción nunca reciben
  escrituras de QA.

Reparto (D5): **G2 y G6** enmiendan `code-standard` I2. **G1, G3, G4, G5, G7**
entran en `qa-standard` como sección nueva de promoción, refinando la tabla de
criticidades existente en vez de duplicarla.

Ambos contratos pasan a versión menor (v1 → v1.1), siguiendo el precedente de
`orchestration.md` v1.2. Los repos siguen declarando `code-standard: v1` y
`qa-standard: v1` en `standards.yaml`: una versión menor no rompe conformidad,
así que no hay drift masivo de sellos.

### Perfil next·supabase·vercel → skills

`supabase start`, `QA_SUPABASE_DB_URL`, `psql`, namespace QA, GitHub Actions,
branch protection vía `gh api`, `pnpm verify:full`, turbo, `deployment_status`
de Vercel, service container de Postgres, secrets: todo esto es *cómo* el perfil
cumple G1-G7.

- `skills/alyp-qa-standard/templates/ci/` — `qa-e2e.yml` pasa a ser el template
  del Gate STG; se suma el template del Gate MAIN (smoke contra el deploy).
- `skills/alyp-qa-standard/templates/qa.config.yaml` — el ambiente de desarrollo
  pasa a `permite_reset: namespace`.
- `skills/alyp-new-project/assets/ci/ci-turborepo.yml` — nombre de job estable.
- `skills/alyp-new-project/assets/ci/branch-protection.sh` — exige el check en
  `staging` y en `main`.
- `docs/environment-strategy.md` — su "Flujo de deployment" se actualiza a los
  tres gates. Queda como documento de perfil, no como norma.

## Tensión resuelta: `permite_reset`

`nomi_v3` y `rrhh` declaran hoy `dev: permite_reset: false` ("PROHIBIDO
truncar/seedear contra este ambiente"), mientras `global-suministros` ya opera
como exige D1: `permite_reset: true` — *SOLO namespace QA* — contra una DB dev
que convive con 2.456 productos y 1.992 clientes reales.

`permite_reset` deja de ser booleano y pasa a expresar el alcance del reset:
`namespace` (acotado, permitido en desarrollo) o `no` (pre-producción y
producción). No es un permiso nuevo: es escribir la regla que global-suministros
ya cumple y que nomi_v3 hoy bloquea por configuración. Los `reset.sql` de los
tres repos ya borran con filtro de namespace o tenant y nunca truncan.

## Concurrencia

Dos PRs simultáneos se pisarían el namespace QA compartido en DEV. G-STG declara
un grupo de concurrencia por repo, de modo que la segunda corrida **espera** en
vez de fallar.

## Adopción

Piloto en **global-suministros** — es el más cerca: 16 flujos, `permite_reset`
ya correcto, gate ya requerido en `staging`; solo le falta corregir el nombre
del check y cargar secrets. Luego **rrhh**, que es el que más lo necesita (15
promociones reales, cero enforcement). Luego el resto de la flota vía el skill.

Los secrets `QA_*` apuntando a DEV los carga una persona: son credenciales, y
el agente no las manipula.

## Decisión abierta

`staging` está declarado `solo_lectura: true` en global-suministros. Con eso el
smoke de G-MAIN solo puede leer (login, health, render de pantallas P0), no
ejercer los tres oráculos completos. La alternativa es habilitar namespace QA
también en staging. Recomendación: empezar solo-lectura y decidir con datos.

## Riesgo asumido

Con D2 (Docker opcional) y D4 (E2E contra DEV real), ningún gate corre contra un
ambiente idéntico a producción antes de main. G-MAIN lo compensa parcialmente
con el smoke contra staging. Es una elección consciente de velocidad de adopción
sobre fidelidad.
