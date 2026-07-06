@RTK.md

# Alyp Studio — contexto global

- Negocio: desarrollo de plataformas SaaS propias y para clientes (Alyp Studio).
- Stack estándar: Turborepo · Next.js · Supabase · Vercel · GitHub. Convención `agentic-standard: v1`.
- Logs, códigos de error y dominio en español (`agenticLogger`, `traceId`, `contexto`).
- Skills propios en `~/.claude/skills/`: `alyp-new-project` (scaffolding SaaS), `alyp-agentic-standards` (estándar de código), `agentic-logging` + `alyp-observability` (logs/OTel), `devstral-orchestration` (offloading local).

## Debug en navegador (Chrome DevTools MCP)

MCP `chrome-devtools` (scope user, `npx chrome-devtools-mcp@latest`, v1.x) — controla un Chrome real vía el protocolo DevTools. Tools `mcp__chrome-devtools__*`: navegar, click/fill/fill_form, leer **consola**, `evaluate_script`, **network requests**, **screenshots/snapshots**, **Lighthouse**, performance trace, emulación móvil, heap snapshots.

- **Usalo para cerrar el loop de validación en Vercel previews**: tras push a develop, navegá a la URL preview, ejecutá los flujos reales, leé la consola y la red. Esto caza lo que `pnpm test` NO ve: errores de runtime en client (server actions 500 / `export type` en `'use server'`, logger en browser, hidratación).
- Es el complemento real de `verification-before-completion`: evidencia en el navegador (screenshot + consola limpia + status 200) antes de promover a staging/main.
- **Seguridad**: controla un Chrome real con sesiones. No abrir flujos destructivos en PROD sin OK explícito; preferí ambientes DEV/preview. Categorías Third-Party y WebMCP (experimentales, requieren flags) quedan apagadas por defecto.
- Costo de contexto: screenshots/snapshots consumen tokens; usalo puntual, no en loop.

## Orquestación de modelos (4 niveles)

Optimizá tokens delegando hacia abajo; mantené tu contexto (Opus) mínimo (leé poco, delegá mucho, recibí resúmenes).

- **Opus (vos, directo)**: planes, arquitectura, seguridad crítica, review final, routing.
- **Sonnet (subagentes vía tool Agent)**: implementación, research, debugging, review no-crítico, verificación en browser. Agentes: `implementador`, `explorador`, `revisor` (en `~/.claude/agents/`).
- **Local (`delegate_to_devstral`)**: tareas mecánicas verificables e inequívocas (tests, codemods, CRUD por template, fixes tsc/lint, docs). Dos tiers — `light` (qwen2.5-coder:3b, default rápido) y `heavy` (qwen3-coder:30b, solo mecánico con razonamiento).
- **qwen2.5-coder:3b (hooks)**: QA automático tras Edit/Write y tras cada delegación.

**Antes de orquestar o delegar por primera vez en la sesión, invocá el skill `devstral-orchestration`** — matriz de routing completa, veredictos (⚠ N/2, 🚨) y principios.

Reglas mínimas aunque el protocolo no esté cargado: si dudás del nivel, subí uno; nunca delegues seguridad/secretos/infra ni cambios irreversibles; al local solo lo verificable; nunca aceptes trabajo delegado sin su resumen/veredicto. `[QA local no disponible]` = Ollama apagado o modelo sin descargar; no es un error de tu trabajo.
