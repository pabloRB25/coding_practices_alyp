# Changelog

## v2.3.0 — 2026-08-16

### `alyp-exec` v1.0.0 — el loop de ejecución, y el invariante de evidencia que faltaba

El ecosistema tenía la matriz de routing (`devstral-orchestration`: **quién** hace cada cosa) pero no el loop de ejecución (**cómo fluye** una tarea de programación de punta a punta). Sin contrato de ida y vuelta, el orquestador terminaba leyendo repo para poder validar — y su ventana, el recurso más caro de la sesión, se llenaba de material que debería haber muerto en el contexto de un subagente.

- **Skill nuevo `alyp-exec`** (perfil de `orchestration`, invariantes 1-7). Núcleo de 3 tiers: Opus orquesta y valida · Sonnet ejecuta y se autovalida · Haiku lectura barata. Define tres estructuras (Contrato de Tarea → Reporte de Tarea → ledger en disco), un loop de 5 fases con olas paralelas particionadas por archivos disjuntos, y dos modos de ejecución sobre las mismas estructuras: **A** conversacional (tool `Agent`, humano en el medio) y **B** harness (tool `Workflow`, plan cerrado). References: `contrato-tarea.md`, `reporte-tarea.md`, `gates.md`, `modo-b-workflow.md`; asset `ledger-init.sh`.
- **`contracts/orchestration.md` → v1.2**, dos enmiendas:
  - **Invariante 2**: el offloading al mecánico pasa de *obligatorio* a **opcional según entorno**. Se alinea con la realidad medida (`mecanico_heavy: null` desde el 2026-08-07 por la colisión de RAM con el evaluador de PAF) y permite que un perfil saque el carril local del camino crítico sin incumplir el contrato.
  - **Invariante 7 (nuevo)**: *la evidencia que decide un veredicto la genera quien juzga, no quien es juzgado*. Cierra un hueco preexistente — el invariante 4 exigía evidencia pero no declaraba **quién la genera**. Piso de aceptación en todo nivel de riesgo: (a) re-ejecución independiente del criterio fijado *antes* de delegar, (b) gate de alcance que excluye los artefactos de verificación, (c) gate de integración por lote.
- **Origen del invariante 7**: consulta al `consultor` Fable sobre la estrategia (2026-08-16). Detectó que en el diseño original toda la evidencia que el orquestador "validaba" había sido generada por la parte juzgada — forjable sin mala fe (salida stale, cwd equivocado, comando que pasa en vacío con 0 casos, reward-hacking sobre el propio test). El diseño lo corrige con los gates **G1 re-ejecución · G2 allowlist · G3 gate de ola**, piso para todo riesgo incluido el 0.
- **Hallazgo del harness**: la tool `Agent` **no expone `effort`** (solo `model`); `agent()` dentro de `Workflow` expone ambos por etapa. La escalación "subí esfuerzo antes que modelo" queda declarada como **exclusiva de Modo B** — regla anti-divergencia: si un modo no puede cumplir una palanca, se declara no disponible, no se emula.
- **`devstral-orchestration` → 2.10.0**: sección de frontera al tope (quién vs cómo; al ejecutar manda `alyp-exec`) y nota de contrato en §Offloading — el umbral de lote+solapamiento de v2.9 ES la forma que toma la opcionalidad del invariante 2 en este perfil.
- **`scripts/install.mjs`**: `alyp-exec` sumado a la lista `SKILLS` (es hardcodeada — un skill nuevo no se despliega solo).
- Diseño completo y trazabilidad de las decisiones: `docs/specs/2026-08-16-alyp-exec-design.md`.

## v2.2.2 — 2026-07-16

### Endurecimiento del ejecutor local — el offloading obligatorio deja de tener falsos positivos

Resuelve los defectos de infra que v2.2.1 dejó pendientes (`~/local-llm-stack`, fuera de este repo, sin versionar). Con "offloading obligatorio" como regla dura, un ejecutor que reporta éxito sin hacer nada es inaceptable. Se arreglaron tres bugs, todos verificados con tests:

- **El hook de supervisión estaba ciego (bug de raíz).** `parse_response_text` leía `tool_response.get("content")`, pero el MCP entrega `{"result": "..."}` como **string JSON serializado** → el hook parseaba un texto vacío/incorrecto. Por eso NUNCA detectaba escrituras (ni reales), no disparaba la escalación por tope de iteraciones, y aprobaba ✅ todo. Fix: `parse_response_text` desenvuelve el sobre `{"result": ...}` (str o dict).
- **Detección de escrituras robusta.** `extract_files_written` ahora ancla en la confirmación real de la tool (`-> OK: escrito {path} ({N} chars)`), que sobrevive al escape de comillas del JSON y al truncado de argumentos a 120 chars (si el modelo mandaba `content` antes que `path`, la ruta se perdía). El parseo de args queda como respaldo. Solo cuenta archivos que existen en disco.
- **No-op ya no es éxito.** `server.py`: cuando el modelo no emite `tool_calls` con trace vacío, en vez de `[El ejecutor local completó la tarea]` devuelve el marcador `[NO-OP]` con diagnóstico (distingue "emitió la tool call como TEXTO" = tool calling roto, de "respondió sin hacer nada"). El hook detecta `[NO-OP]` y el patrón de tool-call-como-texto en el resumen (nunca en el trace) → nuevo veredicto **🚨 ESCALACIÓN por no-op** que NO re-delega (falla idéntico) y, si es tool calling roto, apunta a revisar `MODEL_LIGHT`.
- **Tests**: `hooks/test_supervise_parsing.py` (11 casos con la forma REAL del payload: sobre JSON, comillas escapadas, no-op, tool-call-como-texto, read-only legítimo, tope de iteraciones). Verificación E2E por el harness real: heavy y light escriben, el hook detecta y QA cada archivo, veredicto ✅ correcto; la escritura que antes reportaba "sin archivos escritos" ahora se detecta.
- El MCP recargó y `tier=light` corre `qwen3:4b` (confirmado por `/api/ps`): el offloading obligatorio funciona end-to-end.

## v2.2.1 — 2026-07-16

### devstral-orchestration v2.7.2 — el tier mecánico exige tool calling estructurado

Parche de validación sobre v2.7.1 (misma doctrina). Al probar el offloading obligatorio end-to-end se descubrió que el ejecutor light **no ejecutaba nada**: emitía la llamada `write_file` como texto en `content` en vez de `tool_calls` estructurados. El loop de `server.py` (~línea 330: `if not tool_calls: return "[El ejecutor local completó la tarea]"`) lo interpretaba como fin exitoso → **éxito falso silencioso**. Con "offloading obligatorio" como regla dura, ese era el peor modo de falla posible: la regla central de v2.7.1 enrutaba por default a un tier que no hacía nada y reportaba OK.

- **Requisito nuevo en el protocolo**: el tier mecánico DEBE emitir `tool_calls` estructurados. No alcanza con `capabilities: [tools]` de `/api/show` — un modelo puede declararlo y fallar igual (medido). Síntoma inconfundible: resumen con bloque JSON `{"name": "write_file", ...}` + trace `--- acciones ---` vacío = no-op, no aceptar.
- **`mecanico_light`: `qwen2.5-coder:3b` → `qwen3:4b`**. Medido 2026-07-16 (3 tareas mecánicas directas + 2 delegaciones vía MCP): 3b = **0/5**, qwen3:4b = **4/4**. También verificados OK: gemma4:12b, gpt-oss:20b, qwen3-coder:30b. El 3b queda solo como QA de hooks (no necesita tool calling: devuelve prosa).
- **RAM**: el cambio cuesta +2.4 GB residentes (light+QA: 5.4 → **7.8 GB** de 36, medido con `/api/ps`) y compra un ejecutor que efectivamente ejecuta. Sigue siendo el camino de paralelismo seguro, sin presión de SO. Nota de unidades documentada: disco (`/api/tags`) ≠ cargado (`/api/ps`) porque Ollama pre-asigna KV = `NUM_PARALLEL × num_ctx`; presupuestar siempre con `/api/ps`.
- `capacity.yaml`/example: key nueva `qa`; comentarios con el requisito de tool calling y la medición. El cambio de modelo es de capacity, no de protocolo — como manda el propio contrato.
- SKILL: sección "Requisito duro del tier mecánico" + tabla "Perfil del equipo" con tamaños reales medidos y la nota de que heavy hace paginar el SO (QA 5 s → 167 s), por lo que sigue siendo opt-in.
- Fuera de este repo (infra local, sin versionar): `~/local-llm-stack/devstral-mcp/server.py::MODEL_LIGHT` y `ARCHITECTURE.md` actualizados con la medición. **Pendiente**: el falso positivo de `server.py` (no-op reportado como éxito) y el hook `supervise-devstral.py`, que aprueba con "sin archivos escritos detectados" y además no detectó una escritura real del tier heavy.

## v2.2.0 — 2026-07-16

### devstral-orchestration v2.7.1 — Opus orquesta, Fable consulta, offloading obligatorio

- **Doctrina nueva**: se elimina la dualidad Fable/Opus de v2.5-v2.6. El orquestador es **SIEMPRE Opus** (autoridad plena); Fable existe únicamente como agente `consultor` de **invocación explícita** (duda real o pedido del usuario). Fallbacks: Fable como loop orquesta igual sin consultor (es el techo); Sonnet/Haiku = modo degradado con consulta obligatoria en crítico.
- **Offloading local OBLIGATORIO**: toda subtarea mecánica + verificable + inequívoca VA al ejecutor local (light default; heavy de a una). Queda derogada la regla v2.6 "para velocidad pura, el local es opcional". Excepciones únicas: gobernador saturado (→ haiku), Ollama apagado (→ haiku), contexto > num_ctx o spec ambiguo (→ sonnet). El local es llamable directo por el orquestador Opus y por el implementador Sonnet (cascada).
- **Perfil del equipo** documentado en el SKILL (validado 2026-07-16, M3 Pro 36 GB/12c): light+QA ≈ 6 GB = camino de paralelismo seguro (2 delegaciones vivas), heavy ~21 GB no co-reside; ola cloud = 10, subagentes Opus ≤ 3/ola.
- `capacity.yaml` → **version 2**: nueva key `orquestador` + comentarios de roles v2.7.1 (mismas keys de tiers, sin breaking).
- `contracts/orchestration.md` → **v1.1**: sección "Modo estándar (desde protocolo v2.7)" + invariante 2 endurecido (offloading obligatorio, escalación explícita al juez).
- Agentes `implementador`/`explorador`/`revisor`/`consultor` alineados: el que despacha es el orquestador Opus; cascada local obligatoria en el implementador; consultor = única vía de acceso a Fable. Se quitan modelos locales hardcodeados de las descripciones (fuente: capacity.yaml).
- CLAUDE.md global unificado a v2.7.1 (resuelve el drift v2.5 detectado el 2026-07-16): índice sin modelos hardcodeados, puntero a capacity.yaml.
- v2.6 archivada en `skills/devstral-orchestration/versions/v2.6/`.

## v2.1.0 — 2026-07-06

### Soporte cross-platform (macOS · Linux · Windows)

- Instalador reescrito en Node (`scripts/install.mjs`) — reemplaza el bash; junctions sin admin en Windows, merge de `settings.json` en Node puro (sin dependencia de `python3`), detección de intérprete de Python para token-savings. `install.sh`/`install.ps1` quedan como shims.
- `check-drift.mjs` y `canary.mjs` portados a Node (cross-platform); shims `.sh` conservados.
- CI canario en matriz `ubuntu-latest` + `windows-latest` con smoke de instalación real.
- token-savings 1.0.1: hook usa tempdir portable (no `/tmp`); intérprete tolerante `python`/`python3`.
- Docs: vía plugin elevada como #1 cross-platform; requisitos por plataforma (Node ≥ 20.11; Git for Windows para la herramienta Bash; Python 3 opcional para token-savings).
- Boundary documentado: instalación y meta-QA 100% cross-platform; el uso de skills con shell POSIX requiere Git Bash en Windows (requisito de Claude Code).

## v2.0.0 — 2026-07-06 (en curso)

### El repo pasa a ser fuente de verdad + instalador

- Los 7 skills completos (con assets/references/templates) viven en `skills/`; `~/.claude/skills/` es una instalación (symlink en dev, copia en equipos).
- Capa `contracts/`: invariantes agnósticos versionados, separados del perfil de stack next·supabase·vercel.
- Manifiesto de estándares por repo (`standards.yaml`) + sello `logging-standard: v1`.
- QA cableado como FASE 5.8 de alyp-new-project; FASE 5.5 deja de ser placeholder.
- devstral-orchestration v2.6: tiers abstractos + `capacity.yaml` por máquina.
- Instalador `scripts/install.sh` + empaquetado como plugin de Claude Code.
- Meta-QA: `lint-skills.mjs` + canario en CI.
- Fix agentic-logging 1.1.1 (detectado por el canario de Task 14): (a) logger.ts compila bajo strict + noUncheckedIndexedAccess — non-null assertions en los grupos de captura de `parseLinea`, justificadas por el `if (match)` previo (7 errores TS2322/TS2345/TS2532; sin cambios de comportamiento); (b) `.eslintrc.agentic.cjs` — se quita `allow: []` de `no-console` (el schema de ESLint 8 exige minItems: 1 y abortaba toda la config; el default ya prohíbe todo console.*).
- Fix scripts/canary.sh: error de sintaxis bash latente en el step 3 (heredoc encadenado con `&&` en línea continuada); nunca se había ejecutado porque el step 2 fallaba antes. Con ambos fixes, `./scripts/canary.sh` llega a "CANARIO OK".

## v1 — 2026-05-29

### Versión inicial del ecosistema de skills

**Skills creados:**
- `alyp-new-project` — Orquestador de 16 fases para proyectos SaaS enterprise
- `alyp-agentic-standards` — Estándar agentic-ready v1
- `alyp-observability` — Logging GPS + OTel agnóstico
- `agentic-logging` — Logging standalone para cualquier proyecto Node/TS

**Características principales:**
- Stack: Turborepo + Next.js + Supabase + Vercel + GitHub
- Arquitectura por features: `src/features/<dominio>/<dominio>.<rol>.ts`
- Gate único: `pnpm verify` = typecheck + lint + test
- 3 ambientes reales separados (dev / staging / prod)
- RLS deny-by-default en todas las tablas
- Auth trigger `handle_new_user()` para multi-tenancy
- Logger GPS con honeypot y PII scrub (cero dependencias)
- OTel agnóstico via `@vercel/otel` + env var para backend
- Vercel Log Drain como transporte en producción
- CLAUDE.md slim auto-generado con sello de versión
- Generador de features `pnpm new-feature <dominio>` con migration stub + RLS template
- Patrón de stubs (logger/error-codes) que resuelve dependencias de orden de instalación

**Decisiones arquitectónicas documentadas:**
- `utils/logger.ts` y `utils/error-codes.ts` como stubs tipados en scaffold, reemplazados por implementación completa en FASE 5.5
- `LOG_PROVIDER=local` solo válido para `next dev` local — en Vercel usar `http` + Log Drain
- Staging tiene su propio Supabase (no comparte con develop)
- `createAdminClient()` con service_role: solo en Node runtime, nunca en Edge middleware

**Problemas resueltos respecto a la versión anterior (sin estándar):**
- Sin arquitectura consistente entre proyectos
- Sin RLS por defecto — tablas expuestas sin políticas
- Sin observabilidad — logs text plano, imposibles de consumir por agentes
- Sin gate de verificación — CI no corría tests
- Sin modelo de ambientes coherente — staging y develop compartían DB
- Sin CLAUDE.md slim — el agente arrancaba cada sesión sin contexto
- Sin generador de features — cada feature se scaffoldeaba de forma diferente
