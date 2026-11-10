# agent-steps — qué se está ejecutando y cuánto falta

Mod de Claude Code (function hooks) para cualquier proyecto y ventana. Dibuja un
panel lateral **Pasos**, una banda sobre el prompt cuando el panel está cerrado
y una entrada en la statusline.

## Qué muestra

| Sección | Qué | % | Fuente |
|---|---|---|---|
| **Plan** `▣` | Corridas de `alyp-exec`, como «plan <título>» (o «plan <carpeta>» sin título): aceptadas/total, ola, en curso, bloqueadas, tarea actual | Sí | `progreso.json` del ledger (o `estado.md`, marcado **estimado**) |
| **Tareas** `☑` | Tareas de la sesión y la que está en curso | Sí | TaskCreate / TaskUpdate / TaskList / TodoWrite |
| **Workflow** `⚙` | Nombre, fases y agentes terminados/lanzados | Agentes | `tool.call` Workflow + `agent.spawn` (`workflow.runId`) + `turn.complete` |
| **Ahora** | Herramientas del turno por subagente: `▶` en curso, `✓` hecha, `✗` falló o se cortó, `⧗` en segundo plano | No: tiempo | `tool.call`, `$.agent.list()` |
| **Jobs** `◇` | Jobs trabajando o esperando input (24 h) y fallidos (1 h) | No | `~/.claude/jobs/*/state.json` |

**Regla:** el % solo aparece donde hay contra qué contar. Una herramienta o un
turno no tienen denominador: ahí se muestra el tiempo transcurrido.

## Alcance: este proyecto o todos

Por defecto, planes y jobs se filtran al repo de la sesión, para no mostrar
otros clientes al compartir pantalla.

- `/pasos` abre el panel.
- `/pasos todos` muestra todos los proyectos (se recuerda entre sesiones).
- `/pasos proyecto` vuelve al filtro.

## Cómo encuentra los planes

1. `<repo de la sesión>/.claude/run/*/`.
2. El índice global `~/.claude/run-index/*.json` (o `$CLAUDE_CONFIG_DIR/run-index`),
   que escriben `ledger-init.sh` y `progreso.sh` de `alyp-exec`
   (`skills/alyp-exec/references/progreso.md`).

Se ven los planes sin terminar de la última semana y los terminados en las
últimas 24 h. Se relee el disco cada 10 s.

## Desarrollo

```sh
claude plugin validate mods/agent-steps
claude plugin test mods/agent-steps
```

La lectura de archivos vive en `hooks/leer.ts` (sin `$`), el dibujo y los
eventos en `hooks/register.tsx`, los tipos del estado en `types/index.d.ts`.
Al cambiar los campos de un valor guardado, cambiá su `shape` en `register.tsx`.

## Instalación

El marketplace local `alyp-mods` apunta a la carpeta `mods/` (en esta máquina,
`~/.claude/mods`). Tras cambiar la versión en `.claude-plugin/plugin.json`:

```sh
claude plugin marketplace update alyp-mods
claude plugin update agent-steps@alyp-mods
```

y reiniciar la sesión (o `/reload-plugins`).
