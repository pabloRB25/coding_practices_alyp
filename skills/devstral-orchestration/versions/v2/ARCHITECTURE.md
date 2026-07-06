# Arquitectura del stack de offloading — Alyp Studio

> Estado al **2026-07-01** (orquestación v2: Fable orquesta, Opus razona,
> Sonnet implementa, Qwen local ejecuta lo mecánico). Documenta la configuración
> completa de Claude Code CLI orquestando modelos locales. Fuente de verdad de
> qué corre dónde y por qué.

## Visión general — orquestación v2 en 5 niveles (cascada de aislamiento de contexto)

> v1 (orquestador Opus, 4 niveles) archivada en
> `~/.claude/skills/devstral-orchestration/versions/v1/`.

```
Fable (loop principal, vos) ── ORQUESTADOR ──────────────────────────────┐
  routing · descomposición · síntesis · veredicto final (seguridad/prod)  │
  │                                                                        │
  ├─ Agent(model:opus) ───► subagentes Opus ── RAZONADOR                   │
  │     revisor/implementador en tier opus                                │
  │     (análisis de seguridad crítica, diseño detallado, debugging       │
  │      difícil, juez adversarial — borrador; Fable firma)               │
  │                                                                        │
  ├─ Agent(default) ──────► subagentes Sonnet ── OBRERO                    │
  │     implementador · explorador · revisor                              │
  │     (implementación, research, debugging, review no-crítico)          │
  │     │                                                                  │
  │     └─ delegate_to_devstral ──► tier light: qwen2.5-coder:3b (default) ── MECÁNICO
  │                                  tier heavy: qwen3-coder:30b (razonamiento) │
  │                                  tests, codemods, CRUD por template    │
  │                                  (alternativa cloud: Agent model:haiku) │
  │                                                                        │
  └─ delegate_to_devstral ────────► ejecutor local por niveles (directo)  │
                                                                           │
  hooks (siempre) ─► qa-review.py / supervise-devstral.py ─► qwen2.5-coder:3b ┘
                       QA por archivo · veredicto ✅/⚠/❌/🚨 + tsc/pytest
```

**Principio**: el costo dominante es el contexto que acumula el orquestador
(Fable, el tier más caro del sistema). Delegar usa un modelo más barato **y**
descarta el contexto de la sub-tarea (solo vuelve el resumen). Regla madre:
Fable lee poco, delega mucho, recibe resúmenes — en v2 hasta el razonamiento
pesado baja a subagentes Opus; Fable retiene routing y veredicto. Al local solo
va lo mecánico + verificable + inequívoco. Routing completo en el skill
`devstral-orchestration`.

Solo la orquestación sale a internet. El código nunca abandona la máquina.

## Modelos (Ollama, M3 Pro 36 GB)

| Rol | Modelo | Tamaño | Config | Definido en |
|---|---|---|---|---|
| Ejecutor `tier=light` (default) | `qwen2.5-coder:3b` | ~3 GB | `num_ctx=16384`, `keep_alive=30m`, `temp=0.2` | `server.py::MODEL_LIGHT` |
| Ejecutor `tier=heavy` | `qwen3-coder:30b` (MoE A3B) | ~21 GB | `num_ctx=16384`, `keep_alive=30m` | `server.py::MODEL_HEAVY` |
| QA (hooks) | `qwen2.5-coder:3b` | ~3 GB | `num_ctx=16384`, `keep_alive=10m` | `hooks/*.py::QA_MODEL` |

**RAM / paralelismo (medido)**: el camino rápido y robusto es el **tier light** —
ejecutor 3B + QA 3B = ~6 GB, dos delegaciones concurrentes, sin presión de SO,
QA en ~5 s. El **tier heavy 30B (~21 GB)** cabe en Ollama pero co-residente con el
QA y con Claude Code + Chrome corriendo **presiona el SO a paginar** (una QA trepó
a 167 s vs 5 s). Por eso es opt-in, no default.

Config de Ollama (env, persistida en `~/Library/LaunchAgents/com.alyp.ollama-env.plist`):

| Variable | Valor | Por qué |
|---|---|---|
| `OLLAMA_MAX_LOADED_MODELS` | `2` | ejecutor + QA residentes |
| `OLLAMA_NUM_PARALLEL` | `2` | 2 requests concurrentes/modelo; >2 infla el KV del 30B |
| `OLLAMA_FLASH_ATTENTION` | `1` | reduce KV-cache |
| `num_ctx` ejecutor | `16384` | Ollama pre-asigna KV = `NUM_PARALLEL × num_ctx` (con 32768×3 el 30B trepaba a 28 GB) |

> Los nombres `delegate_to_devstral` (tool) y los archivos `*devstral*` se conservan
> por compatibilidad con `settings.json` y los permisos. El modelo ya no es Devstral.

## Piezas

- **`devstral-mcp/server.py`** — MCP stdio. Tool `delegate_to_devstral(task, working_dir)`.
  Loop agéntico (máx 20 iter) con tools `read_file`/`write_file`/`list_dir`/`run_bash`
  restringidas al `working_dir`. **Toma el modelo nuevo solo al reiniciar Claude Code.**
- **`hooks/qa-review.py`** — PostToolUse `Edit|Write`. Revisa con qwen2.5-coder:3b, inyecta
  ≤2000 chars. No bloqueante (exit 0 siempre). `[QA local no disponible]` = Ollama apagado.
- **`hooks/supervise-devstral.py`** — PostToolUse de la tool de delegación. QA de los
  archivos producidos + `tsc --noEmit`/`pytest`. Loop de reintentos (máx 2) y escalación.

## Veredictos del supervisor

| Veredicto | Acción de Claude |
|---|---|
| ✅ APROBADO | Continuar |
| ⚠ REINTENTO N/2 | Re-delegar con el `delegate_to_devstral()` exacto del hook (no editar el prefijo) |
| ❌ No resuelto en 2 intentos | Corregir directo con Edit/Write/Bash |
| 🚨 ESCALACIÓN (tope de iteraciones) | Tomar el trace y completar con herramientas propias |

## Bugs corregidos (no reintroducir)

1. **retry-key**: `_retry_key` normaliza el prefijo `CORRECCIÓN (intento N/M):`. Antes
   cada corrección generaba clave nueva → el contador nunca llegaba a ❌.
2. **parsing thinking-safe**: `"QA OK" in review[:80]` + strip de `<think>…</think>`.
   El QA viejo (gpt-oss) razonaba inline; `startswith` daba falsos rechazos. El QA
   actual (qwen2.5-coder:3b) no razona → el campo `think` se omite del body si es `None`.
3. **drift de modelo**: una sola constante por archivo; mensajes genéricos ("QA local").

## Configuración de Claude Code (`~/.claude/`)

- **CLAUDE.md** (19 líneas): identidad Alyp + routing mínimo → invocar skill `devstral-orchestration`.
- **skills/**: `devstral-orchestration` (cerebro de routing multi-modelo),
  `agentic-logging`, `alyp-observability`, `alyp-agentic-standards`,
  `alyp-new-project` — estructura Agent Skill (SKILL.md + references on-demand +
  assets copiables). Migrados desde `commands/` monolíticos.
- **agents/**: subagentes Sonnet despachables con la tool Agent — `implementador`
  (features multi-archivo, delega lo mecánico al local), `explorador` (research
  read-only), `revisor` (review no-crítico, escala seguridad crítica a Opus).
- **settings.json**: hooks (rtk con guard `command -v rtk`; qa timeout 120s; supervisor).
- **settings.local.json**: permisos 527→297 (19 wildcards seguros + literales).

## Monitoreo

```bash
~/.claude/scripts/monitor.sh                      # tmux (macmon opcional + panel Ollama)
python3 ~/.claude/scripts/ollama-monitor.py       # panel solo
python3 ~/.claude/scripts/ollama-monitor.py --once  # un frame (testing)
```

El panel muestra CPU%/GPU%/RAM/presión/swap del host y, por modelo cargado: split
CPU/GPU, contexto, keep-alive y estado `▶ generando` / `⏸ idle`.

## Cómo probar el flujo completo

1. Reiniciar Claude Code (para que el MCP cargue el ejecutor por niveles).
2. Con el monitor abierto, pedir:
   `delegá al modelo local crear un util.py con fibonacci y sus tests`.
3. Observar cargar qwen2.5-coder:3b (ejecutor light + QA) coexistiendo sin swap;
   el tier heavy (qwen3-coder:30b) solo se carga si la tarea lo pide.

## Pendientes (decisión del usuario)

- Plugins por proyecto en vez de user-global (reduce contexto por sesión).
- Elegir un solo sistema de memoria: engram vs nativa de Claude Code vs productivity.
