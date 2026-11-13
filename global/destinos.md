# Destinos de la poda del CLAUDE.md global (2026-11)

Fuente: `~/.claude/backups/2026-11-poda/CLAUDE.md` (196 líneas). Cada fila es una regla o viñeta
del archivo viejo y el lugar donde quedó. `CLAUDE.md` = `global/CLAUDE.md`; `(coment.)` = comentario
HTML en línea propia (solo así Claude Code lo quita; inline se inyecta), queda como "por qué"; `rules/` = `global/rules/`.

| # | Regla vieja (cita corta) | Destino |
|---|---|---|
| 1 | `@RTK.md` (import) | Quitado. CLAUDE.md §RTK y búsquedas (3 viñetas) + puntero a `~/.claude/RTK.md` |
| 2 | Regla #0: prioridad sobre cualquier skill/harness/Workflow | CLAUDE.md §Planificar no es ejecutar, viñeta 1 |
| 3 | Al planear, la salida es el documento y nada más | CLAUDE.md §Planificar, viñeta 1 |
| 4 | Visto bueno explícito por escrito ("ejecutá", "dale", "corré el plan") | CLAUDE.md §Planificar, viñeta 2 ("corré el plan" omitido como ejemplo) |
| 5 | Pedir escribir/probar/revisar no autoriza ejecutar | CLAUDE.md §Planificar, viñeta 2 |
| 6 | Prohibido dry run / `--dry-run` / simulación | CLAUDE.md §Planificar, viñeta 3 |
| 7 | Anécdota nomi_v3 2026-07-16 (`args` que no aplican) | CLAUDE.md §Planificar (coment.) |
| 8 | "Si dudás si algo cuenta como ejecutar: cuenta" | CLAUDE.md §Planificar, viñeta 3 |
| 9 | Prohibido "solo la primera tarea" / "un bloque para validar" | CLAUDE.md §Planificar, viñeta 3 |
| 10 | Prohibido PRs, ramas, commits, cambios de plataforma derivados | CLAUDE.md §Planificar, viñeta 3; enforcement: viñeta 5 (hook `guarda-plan.sh`) |
| 11 | Prohibido delegar la ejecución "para ir adelantando" | CLAUDE.md §Planificar, viñeta 3 |
| 12 | Permitido: escribir, validar sintaxis estática, review solo-lectura, preguntar | CLAUDE.md §Planificar, viñeta 4 |
| 13 | Probar un harness = estático, nunca una corrida | CLAUDE.md §Planificar, viñeta 4 |
| 14 | Al terminar: presentá, pará, preguntá "¿Doy visto bueno para ejecutar?" | CLAUDE.md §Planificar, viñeta 4 |
| 15 | Negocio SaaS propio y para clientes | CLAUDE.md §Alyp Studio, viñeta 1 |
| 16 | Stack + convención `agentic-standard: v1` | CLAUDE.md §Alyp Studio, viñeta 1 |
| 17 | Logs/errores/dominio en español | CLAUDE.md §Alyp Studio, viñeta 2 |
| 18 | alyp-brain: `ficha` antes de responder sobre cliente/proyecto, citá fuente | CLAUDE.md §Alyp Studio, viñeta 3 |
| 19 | alyp-brain: `identidad.dominios`/`repos` con Gmail/Calendar/GitHub | CLAUDE.md §Alyp Studio, viñeta 3 (sin nombrar Gmail/Calendar/GitHub) |
| 20 | alyp-brain: vault `~/alyp-brain`, repo privado, MCP solo lectura, `docs/` | CLAUDE.md §Alyp Studio (coment.) |
| 21 | Catálogo de skills propios en `~/.claude/skills/` | CLAUDE.md §Alyp Studio (coment.); el harness ya lista los skills con descripción |
| 22 | Cada tool call re-lee todo el contexto; 94.222 req, 67%, 47,5%, 20,6% | `skills/alyp-token-savings/SKILL.md` §Métricas de costo; CLAUDE.md §Costo (coment.) |
| 23 | Escala de costo $0,059→$0,435; compactar cerca de 150K rinde 2,6× | `skills/alyp-token-savings/SKILL.md` §Cómo medir (ya estaba); CLAUDE.md §Costo (coment.) |
| 24 | `context-guard` avisa a 150K y a 300K | `skills/alyp-token-savings/SKILL.md` (tabla de artefactos + descripción línea 5) |
| 25 | Compactar cerca de 150K | CLAUDE.md §Costo de contexto, viñeta 1 |
| 26 | `/compact <qué preservar>`, no pelado | CLAUDE.md §Costo, viñeta 1 |
| 27 | Nunca compactar en medio de un debug activo | CLAUDE.md §Costo, viñeta 1 |
| 28 | Rutas absolutas; nunca `cd` suelto; `git -C`/`pnpm --dir`/`cd X && cmd` | CLAUDE.md §Costo, viñeta 2 |
| 29 | Nunca la regla "no uses cd" a secas (pnpm test en dir equivocado) | CLAUDE.md §Costo, viñeta 2 (coment.) |
| 30 | Encadenar con `&&`, nunca `;` (esconde el fallo del medio) | CLAUDE.md §Costo, viñeta 2 |
| 31 | Nunca combinar encadenado con truncado (`\| tail`); filtrá por `: error` | CLAUDE.md §RTK y búsquedas, viñeta 3 |
| 32 | Nunca encadenar a través de un punto de decisión (`test && commit`) | CLAUDE.md §Costo, viñeta 2 |
| 33 | Agrupar llamadas independientes; agresivo en lectura; Edit/Write archivos distintos | CLAUDE.md §Costo, viñeta 3 ("agresivo en lectura" explícito) |
| 34 | 33% del orquestador >300K vs 6,1% subagentes | `skills/alyp-token-savings/SKILL.md` §Métricas de costo |
| 35 | Barridos/trawls/Bash de reconocimiento → `explorador`; se delega exploración, no verificación | CLAUDE.md §Costo, viñeta 4 |
| 36 | Medir con `token-audit.sh`; altura de compactación, objetivo <200K, 388.723 | CLAUDE.md §Costo, viñeta 4 (puntero) + (coment.); `skills/alyp-token-savings/SKILL.md` §Cómo medir |
| 37 | Progresión find/fd/Glob → grep/Grep → ast-grep → Serena → leer rangos | CLAUDE.md §Navegación de código |
| 38 | No `rtk find`/`rtk grep` (falsos negativos) | CLAUDE.md §RTK y búsquedas, viñeta 2; `skills/alyp-token-savings/artifacts/RTK.md` |
| 39 | `tokei` antes de explorar un repo grande | CLAUDE.md §Navegación de código |
| 40 | LSP no arranca en sesiones cloud; caé a grep/ast-grep | rules/codigo.md, viñeta 1 |
| 41 | Ningún agente solo-lectura recibe Serena (escritura simbólica fuera de `permissions`) | rules/agentes-config.md, viñeta 1 (paths ampliados a `agents/*.md`, `.mcp.json`, `settings*.json`) |
| 42 | `excluded_tools` ya sacó 4 tools; simbólicas se conservan a propósito | rules/agentes-config.md, viñeta 2 |
| 43 | Garantía estructural: `explorador` usa `typescript-lsp`, no Serena | rules/agentes-config.md, viñeta 3 |
| 44 | `serena_config.yml` lo gestiona la máquina (reescribe, borra comentarios, poda) | rules/agentes-config.md, viñeta 4 |
| 45 | No documentar razones ahí ni agregar proyectos a mano; 2026-08-31 19→14 | rules/agentes-config.md, viñeta 5 (+ coment.) |
| 46 | `hyperfine` solo para comparar rendimiento | rules/codigo.md, viñeta 4 |
| 47 | Matar por puerto (`lsof -ti ...`) o PID (`$!`), nunca por nombre | CLAUDE.md §Procesos |
| 48 | Contenedores: `docker stop <nombre>` | CLAUDE.md §Procesos |
| 49 | Lo hace cumplir `guarda-kill.sh` (PreToolUse, también subagentes) | CLAUDE.md §Procesos ("también subagentes" omitido) |
| 50 | Anécdota 2026-10-21 pkill next-server / Docker / tmux | CLAUDE.md §Procesos (coment.) |
| 51 | Chrome DevTools MCP: qué es y sus tools | rules/frontend.md (coment. bajo el título) |
| 52 | Validar en preview de Vercel tras push a develop (consola, red, flujos) | rules/frontend.md, viñeta 1; ancla en CLAUDE.md §Avance y verificación, viñeta 3 |
| 53 | Complemento de `verification-before-completion`; evidencia antes de promover | rules/frontend.md, viñeta 2 |
| 54 | No flujos destructivos en PROD sin OK; Third-Party/WebMCP apagadas | rules/frontend.md, viñeta 3; resumen en CLAUDE.md §Avance y verificación, viñeta 3 |
| 55 | Usar puntual por costo de contexto | rules/frontend.md, viñeta 4 |
| 56 | Optimizar tokens delegando hacia abajo; contexto de orquestador mínimo | CLAUDE.md §Orquestación, viñeta 2 |
| 57 | Mapeo tier→modelo y límites en `~/.claude/capacity.yaml`; `versions/` | CLAUDE.md §Orquestación, viñeta 3; `versions/` en devstral-orchestration (ya estaba) |
| 58 | Orquestador Sonnet: routing, contratos, olas, G1–G3, síntesis; no firma | CLAUDE.md §Orquestación, viñeta 1; devstral-orchestration §Los 6 roles |
| 59 | Medición 83,8% / 57,1% / 5,6% | devstral-orchestration (ya estaba); CLAUDE.md §Orquestación (coment.) |
| 60 | Loop Opus/Fable firma inline (revertido en v3.4.0: G0 y riesgo 2 van a contexto fresco); Haiku no orquesta | devstral-orchestration §¿Quién orquesta? (ya estaba) |
| 61 | Opus firma en G0, diff de riesgo 2, veredicto de merge; firma final | CLAUDE.md §Orquestación, viñeta 1; devstral-orchestration (ya estaba) |
| 62 | Consultor Fable: solo invocación explícita; cuándo; paquete cerrado | CLAUDE.md §Orquestación, viñeta 1; detalle en devstral-orchestration §Consultor Fable |
| 63 | Subagentes Opus para razonamiento pesado, máx 2-3 por ola; heisenbug con repro | devstral-orchestration §Matriz / §Scheduler (ya estaba) |
| 64 | Subagentes Sonnet `implementador`/`explorador`/`revisor`/`consultor`; parámetro `model` | CLAUDE.md §Orquestación, viñeta 2; devstral-orchestration §Los 6 roles |
| 65 | Local `delegate_to_devstral`: mecánico+verificable+inequívoco; gobernador `max_delegaciones_vivas`; light/heavy | CLAUDE.md §Orquestación, viñeta 2; devstral-orchestration §Offloading (ya estaba) |
| 66 | QA local por hooks tras Edit/Write y delegación | devstral-orchestration §QA automático (ya estaba) |
| 67 | Invocar `devstral-orchestration` (quién) y `alyp-exec` (cómo) antes de orquestar | CLAUDE.md §Orquestación, viñeta 3 |
| 68 | Ante conflicto sobre el loop de ejecución manda `alyp-exec` | Detalle en el propio skill `alyp-exec`; CLAUDE.md §Routing de skills, viñeta 2 ("loop de alyp-exec") |
| 69 | Si dudás del nivel, subí uno | CLAUDE.md §Orquestación, viñeta 4 |
| 70 | Nunca delegar seguridad/secretos/infra/irreversibles; al local solo lo verificable | CLAUDE.md §Orquestación, viñeta 4 |
| 71 | Nunca aceptar sin resumen/veredicto ni sobre evidencia del propio ejecutor (inv. 7) | CLAUDE.md §Orquestación, viñeta 5; agregado a devstral-orchestration §Reglas generales |
| 72 | No firmes tus propios contratos (inv. 8 y 9) | CLAUDE.md §Orquestación, viñeta 5; agregado a devstral-orchestration §Reglas generales |
| 73 | Sin tier razonador, riesgo 2 se detiene y se escala | CLAUDE.md §Orquestación, viñeta 5 ("se escala al usuario"); devstral-orchestration §Principios 2 |
| 74 | `[QA local no disponible]` = Ollama apagado, no error | CLAUDE.md §Orquestación (coment.); devstral-orchestration (ya estaba) |
| 75 | Spec técnico → brainstorming; PRD → write-spec; PRD previo no se reescribe | CLAUDE.md §Routing de skills, viñeta 1 |
| 76 | Planes: `alyp-exec`; roles en `contracts/execution.md` vía subagent-driven-development | CLAUDE.md §Routing, viñeta 2 |
| 77 | `executing-plans` solo a pedido; no agente `Plan` (manda writing-plans) | CLAUDE.md §Routing, viñeta 2 ("manda writing-plans" omitido) |
| 78 | Carriles por tamaño: devstral-orchestration §Carriles | CLAUDE.md §Routing, viñeta 3 |
| 79 | Exploración en repos Alyp → `explorador`, no `Explore` | CLAUDE.md §Routing, viñeta 3 |
| 80 | Review: tabla única en devstral-orchestration | CLAUDE.md §Routing, viñeta 3 |
| 81 | `frontend-design` subordinado al design system; manda solo en greenfield | CLAUDE.md §Routing, viñeta 4 |
| 82 | `verify` delega en `qa/flujos/` (qa-standard) | CLAUDE.md §Routing, viñeta 4 |
| 83 | Arquitectura → architecture-standards + engineering-baseline; ADR en `docs/adr/` | CLAUDE.md §Routing, viñeta 5 |
| 84 | Legacy → `guides/remediacion-legacy.md` (auditar antes) | CLAUDE.md §Routing, viñeta 6 |
| 85 | Evidencia canónica en `contracts/qa-standard.md`, no re-redactar | CLAUDE.md §Routing, viñeta 6 ("no re-redactar" implícito en "canónica") |
| 86 | Código muerto se borra, no se comenta ni archiva; mismo PR | CLAUDE.md §Routing, viñeta 8; rules/codigo.md, viñeta 2 (con `/old`, `_deprecated`, "git es el archivo") |
| 87 | Detección y gate de código muerto: knip, alyp-agentic-standards §FASE 4.5 | rules/codigo.md, viñeta 3 |
| 88 | Fronteras de memoria (tabla de 4 filas) | CLAUDE.md §Memoria |
| 89 | Las demás copias de una regla son punteros | CLAUDE.md §Memoria ("Lo demás son punteros") |
| 90 | TaskCreate/TaskUpdate en trabajo de ≥3 pasos; % del panel Pasos | CLAUDE.md §Avance y verificación, viñeta 1 |
| 91 | Con alyp-exec el % oficial es `progreso.json`, no deducido de `estado.md` | CLAUDE.md §Avance y verificación, viñeta 2 (`assets/progreso.sh` y anécdota 29/41 en coment.) |
| 92 | El mod vive en `coding_practices_alyp/mods/agent-steps` | CLAUDE.md §Avance (coment.) — layout de repo |
| 93 | graphify: ante `/graphify`, usar el skill antes que nada | CLAUDE.md §Routing de skills, viñeta 7 |

## Del RTK.md viejo (135 → 37 líneas visibles)

| Regla vieja | Destino en `skills/alyp-token-savings/artifacts/RTK.md` |
|---|---|
| Usalo explícito; hook no confiable (~0.9%); aplica a subagentes; no duplicar `rtk` | viñeta 1 |
| No `rtk find`/`rtk grep` + por qué + reconfirmar con herramienta plana | viñeta 2 (evidencias 2026-07-16 y 2026-08-12 en coment.) |
| Tabla de búsquedas y "Navegación especializada" (progresión) | viñeta 2 (herramientas) + CLAUDE.md §Navegación |
| Herramientas sin rtk; las que modifican estado requieren aprobación explícita | viñeta 4; regla en rules/agentes-config.md (última viñeta) |
| Nunca truncar por posición; filtrá por errores; vacío = evidencia | viñeta 3 (anécdota 2026-08-07 en coment.) |
| Tabla de comandos | tabla, intacta |
| Meta commands + verificación de instalación + colisión de nombre | sección final |
| Hook fallback | viñeta 1 |
| Nota sobre adherencia (13,9%, sin objetivo) | viñeta 4 (coment.) |
