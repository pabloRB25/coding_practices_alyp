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

## Qué plan muestra cada ventana

Cada sesión muestra **el plan que ella misma trabaja**, no los que hay en su
carpeta: una ventana abierta en `~/Dev/cayuga` no es "el plan fable-v1" solo
porque ese ledger cuelga de ahí. Un plan queda vinculado a la sesión cuando:

- la sesión o uno de sus subagentes toca su ledger (`cat …/.claude/run/<plan>/estado.md`,
  `progreso.sh .claude/run/<plan>`, editar un contrato…), o
- se vincula a mano: `/pasos plan <nombre>` (del índice o del repo) o `/pasos plan <ruta>`.

El % de **tareas** también es de la sesión: sale de sus propias TaskCreate.

## Alcance de jobs: este proyecto o todos

Por defecto los jobs se filtran, para no mostrar otros clientes al compartir pantalla:

- dentro de un repo git: los jobs de ese repo;
- fuera de un repo: los que cuelgan de la carpeta, salvo en el home y su primer
  nivel (`~`, `~/Dev`), donde solo los de esa misma carpeta.

`/pasos todos` muestra todos los jobs y todos los planes vigentes (se recuerda
entre sesiones); `/pasos proyecto` vuelve al filtro; `/pasos` abre el panel.

## Cómo encuentra los planes

1. Los vinculados a la sesión (siempre).
2. Con `/pasos todos`, además `<repo>/.claude/run/*/` y el índice global
   `~/.claude/run-index/*.json` (o `$CLAUDE_CONFIG_DIR/run-index`), que escriben
   `ledger-init.sh` y `progreso.sh` de `alyp-exec` (`skills/alyp-exec/references/progreso.md`).

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
