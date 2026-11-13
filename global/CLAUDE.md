# Reglas globales
<!-- Poda 2026-11: el detalle vive en rules/*.md, en ~/.claude/RTK.md y en los skills; mapa completo en global/destinos.md del repo coding_practices_alyp. -->

## Planificar no es ejecutar
<!-- Ex regla dura #0. Origen: en nomi_v3 (2026-07-16) un dry run con `args` que no aplicaban corrió todo de verdad. -->
- Manda sobre cualquier skill, harness o Workflow: al planear (plan, spec, harness, runbook) la salida es el documento y nada más.
- Nada se ejecuta sin un visto bueno explícito y por escrito de ejecución ("ejecutá", "dale"); pedir escribir, probar o revisar un plan no lo autoriza.
- Sin ese visto bueno: ni dry run, ni "solo la primera tarea", ni ramas, commits, PRs o cambios de plataforma derivados, ni delegar la ejecución. Si dudás si algo cuenta como ejecutar, cuenta.
- Validar un plan es estático (parseo, `--check`, lint, lectura, review), nunca una corrida. Al terminar, presentá el plan, pará y preguntá si das visto bueno para ejecutar.
- El hook `guarda-plan.sh` pide permiso para Workflow, `gh api` mutante, `git push`, `gh pr create/merge`, `gh repo edit` y `gh secret`.

## Alyp Studio
<!-- Skills propios: alyp-new-project (scaffolding SaaS), alyp-agentic-standards (estándar de código), agentic-logging + alyp-observability (logs/OTel), devstral-orchestration (routing multi-modelo), alyp-exec (loop de ejecución), alyp-graph (radio de impacto y piso de riesgo de un contrato), alyp-codebase-maintenance (mantenimiento periódico). Skills en ~/.claude/skills/. Vault alyp-brain = repo privado alyp-studio/alyp-brain, plan y decisiones en su docs/. -->
- SaaS propios y para clientes. Stack Turborepo · Next.js · Supabase · Vercel · GitHub; convención `agentic-standard: v1`.
- Logs, códigos de error y dominio en español (`agenticLogger`, `traceId`, `contexto`).
- Antes de responder sobre un cliente, proyecto, pendiente o relación, llamá `ficha` de alyp-brain (o `pendientes`/`proyectos`/`buscar`) y citá la fuente; para correo, agenda y repos usá sus `identidad.dominios`/`repos`.

## RTK y búsquedas
<!-- Evidencias fechadas de los falsos negativos en ~/.claude/RTK.md. -->
- Usá `rtk` explícito en read/ls/git/npm/vitest/lint/gh/curl/docker; detalle en `~/.claude/RTK.md`.
- Nunca `rtk find` ni `rtk grep`: dan falsos negativos verificados. Buscá con find/fd/Glob, grep/Grep, ast-grep o Serena.
- Filtrá por errores (`grep -E ": error"`), nunca truncar la salida por posición (`| tail`).

## Navegación de código
- Progresión: `find`/Glob → `grep -rn`/Grep → ast-grep → Serena → leer solo rangos. Repo grande: medilo antes con `tokei`.

## Costo de contexto
<!-- Sobre 94.222 requests el cache_read es el 67% del costo; el costo por request va de $0,059 (50-150K) a $0,435 (500-800K); compactar cerca de 150K rinde 2,6x más que a 300K; altura de compactación 388.723 en ago-2026, objetivo <200K. Detalle en el skill alyp-token-savings §Métricas de costo. -->
- Compactá cerca de 150K con `/compact <qué preservar>`; nunca en medio de un debug activo.
- Rutas absolutas, nunca un `cd` suelto (`git -C`, `pnpm --dir` o `cd X && cmd`); encadená con `&&`, nunca con `;`, ni a través de un punto de decisión (`test && commit`).
<!-- No reducirlo a "no uses cd": pnpm test corre en el directorio equivocado y da un resultado plausible pero falso. -->
- Agrupá en un mensaje las llamadas independientes (agresivo en lectura); en Edit/Write, solo archivos distintos sin orden entre sí.
- Barridos y Bash de reconocimiento van al `explorador`: se delega la exploración, nunca la verificación. Medí con `~/.claude/scripts/token-audit.sh`.

## Procesos
<!-- 2026-10-21 23:28: un pkill -f next-server de un subagente coincidió con la caída de Docker Desktop y tmux; corren varias sesiones de Claude en paralelo. -->
- Matá por puerto (`lsof -ti tcp:<puerto> -sTCP:LISTEN | xargs kill`) o PID guardado (`$!`), nunca por nombre (`pkill`, `killall`); contenedores con `docker stop`. Lo hace cumplir `guarda-kill.sh`.

## Orquestación de modelos
<!-- v3.0. Medido may-ago 2026: el loop era el 83,8% del costo; se paga por releer, no por pensar. `[QA local no disponible]` = Ollama apagado, no un error tuyo (ver devstral-orchestration). -->
- Sonnet orquesta y ejecuta (contratos, olas, gates G1–G3) y no firma; Opus firma por invocación en G0, diff de riesgo 2 y veredicto de merge; `consultor` (Fable) solo explícito.
- Subagentes `implementador`, `explorador`, `revisor`; lo mecánico y verificable va al local (`delegate_to_devstral`). Leé poco, delegá mucho, recibí resúmenes.
- Antes de orquestar o delegar por primera vez, invocá `devstral-orchestration` (quién) y `alyp-exec` (cómo fluye). Límites en `~/.claude/capacity.yaml`.
- Si dudás del nivel, subí uno. Nunca delegues seguridad, secretos, infra ni irreversibles; al local, solo lo verificable.
- Nunca aceptes trabajo delegado sin re-ejecutar vos la verificación fijada antes de delegar. No firmes tus propios contratos; sin tier razonador, riesgo 2 se detiene y se escala al usuario.

## Routing de skills
- Spec técnico → `superpowers:brainstorming`; PRD → `product-management:write-spec`; un PRD previo es input, no se reescribe.
- Planes: loop de `alyp-exec`, roles en `contracts/execution.md` vía `subagent-driven-development`; `executing-plans` solo a pedido; nunca el agente `Plan`.
- Explorar repos Alyp → `explorador`, no `Explore`. Review y carriles: tablas de `devstral-orchestration`.
- `frontend-design` se subordina al design system del repo salvo greenfield. `verify` delega en `qa/flujos/`.
- Arquitectura → `architecture-standards` + `contracts/engineering-baseline.md`; decisión de una vía = ADR en `docs/adr/`.
- Legacy → `guides/remediacion-legacy.md` (auditar antes de tocar). Evidencia: canónica en `contracts/qa-standard.md`.
- Ante `/graphify`, primero el skill graphify.
- Código muerto se borra, nunca se comenta ni se archiva; si un cambio deja código sin referencias, eliminalo en el mismo PR.

## Memoria
- Reglas globales → acá y rules; hechos episódicos → engram; metodología por repo → skills locales (alyp-maestro); preferencias → memoria del harness. Lo demás son punteros.

## Avance y verificación
<!-- El mod agent-steps vive en coding_practices_alyp/mods/agent-steps. Dos lectores de estado.md dieron 29/41 y 31/41 sobre el mismo archivo. -->
- Trabajo de ≥3 pasos: `TaskCreate` y `TaskUpdate` (`in_progress`/`completed`); alimentan el % del panel Pasos.
- Con `alyp-exec`, el % oficial es el de `progreso.json`, nunca uno deducido de `estado.md`.
- Browser: Chrome DevTools MCP sobre previews DEV; nunca flujos destructivos en PROD sin OK explícito (detalle en rules/frontend.md de ~/.claude).
