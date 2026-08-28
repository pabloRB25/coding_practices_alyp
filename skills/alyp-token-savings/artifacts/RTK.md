# RTK - Rust Token Killer

**Usage**: Proxy CLI optimizado en tokens (60-90% de ahorro en operaciones de dev).

> ⚠️ **USALO EXPLÍCITAMENTE.** El hook `PreToolUse` NO reescribe los comandos de forma
> confiable en este harness (verificado: cobertura ~0.9%). Prependé `rtk` a mano en los
> comandos de la tabla de abajo. Aplica al agente principal Y a los subagentes.

> 🔴 **NO uses `rtk` para BUSCAR.** `rtk find` y `rtk grep` devuelven **falsos negativos**
> — ver la sección "Búsquedas" más abajo. Una búsqueda que miente cuesta mucho más que
> los tokens que ahorra.

## Regla operativa

Antes de correr un comando de dev, usá su equivalente `rtk` **si está en esta tabla**.
Si el comando ya empieza con `rtk`, no lo dupliques.

| En vez de… | Usá… | Ahorro típico |
|-----------|------|---------------|
| `cat <file>` / `cat -n` | `rtk read <file>` | medio |
| `ls -la` | `rtk ls` | medio |
| `git status` / `git diff` / `git log` | `rtk git <sub>` | alto |
| `npm run <script>` / `npm ci` | `rtk npm run <script>` | alto |
| `npx vitest run` / `vitest` | `rtk vitest run` | ~94% |
| `npx eslint .` / `eslint` | `rtk lint eslint .` | ~99% |
| `diff -u a b` | `rtk diff a b` | alto |
| `wc -l` | `rtk wc -l` | medio |
| `curl -s <url>` | `rtk curl -s <url>` | medio |
| `docker exec …` | `rtk docker exec …` | medio |
| `gh pr …` / `gh …` | `rtk gh …` | medio |
| `dotnet build` / `dotnet test` | `rtk dotnet <sub>` | alto |
| `npx -y <pkg>` | `rtk npx -y <pkg>` | medio |

Regla general: **`rtk <herramienta> <args>`** para lectura de archivos, listados,
status/diff de git, scripts de npm, tests, lint y builds.

## 🔴 Búsquedas: NO con rtk

`rtk find` y `rtk grep` **quedaron fuera de la tabla a propósito**. Devuelven falsos
negativos, verificado dos veces:

- **2026-07-16** — `rtk find` buscando `*monitor*` y `*capacity*` en `~/.claude` devolvió
  `0 for '*monitor*'` y salida vacía, mientras `find` plano con los mismos flags encontró
  `~/.claude/scripts/monitor.sh`, `ollama-monitor.py` y `capacity.yaml`.
- **2026-08-12** — `rtk grep` buscando `alyp\.studio` con `--include=*.md,*.ts,*.tsx,*.json`
  en `~/Dev/alyp-studio/alypstudio` devolvió vacío, mientras `grep -rn` con los mismos
  flags encontró 20+ coincidencias (README, docs legales, `SITE_URL` en `src/pages/`).

**Por qué importa más que el ahorro:** una búsqueda que miente hace concluir "no existe"
sobre algo que sí está. Ese error se propaga a todo lo que venga después — se escribe
código duplicado, se declara imposible algo que ya está resuelto, se cierra un bug que
sigue vivo. Ningún porcentaje de tokens compensa eso.

**Qué usar para buscar:**

| Para… | Usá |
|---|---|
| Localizar archivos por nombre/ruta | `find` plano, `fd`, o la tool `Glob` |
| Buscar texto, nombres, imports | `grep -rn` plano, o la tool `Grep` |
| Patrones sintácticos / AST | `ast-grep` (`sg`) |
| Símbolos, definiciones, referencias | Serena |

Si por costumbre corriste un `rtk find` / `rtk grep` y dio 0 resultados, **reconfirmá con
la herramienta plana antes de afirmar que algo no existe.**

`rtk read`, `rtk ls` y `rtk git` no mostraron este problema y siguen recomendados.

## Navegación especializada (fuera de RTK)

Progresión — pará tan pronto tengas evidencia suficiente:

1. `find` / `fd` / `Glob` para localizar archivos por nombre o ruta.
2. `grep -rn` / `Grep` para texto, nombres, imports o cadenas conocidas.
3. `ast-grep` (`sg`) para patrones sintácticos, llamadas y estructuras AST.
4. Serena para símbolos, definiciones, referencias y relaciones entre archivos.
5. Leé solamente los archivos o rangos que devolvió la búsqueda.

Herramientas auxiliares:

- `tokei`: dimensionar lenguajes y tamaño de un repo antes de explorarlo.
- `hyperfine`: comparar rendimiento solo cuando la tarea pida benchmarking.
- `mise` / `direnv`: detectar y activar el entorno declarado por el proyecto.
- `delta`: salida visual para humanos; para el agente preferí `rtk git diff`.

Estas se ejecutan **directamente**, sin prefijo `rtk`: RTK no las proxifica. `ast-grep`
con rewrite/update, `fd --exec`, `hyperfine`, `direnv allow` y `mise install` pueden
ejecutar o modificar estado; requieren aprobación explícita y nunca deben quedar
preautorizados con comodines amplios.

## ⚠️ Nunca truncar la salida por posición

`rtk` reduce tokens filtrando, no truncando — y ese es el criterio correcto para
cualquier salida. Canalizar un build por `| tail` mostró `Container Started` y
`Time Elapsed` **mientras el build fallaba** (2026-08-07, CJK): se perdieron varios
ciclos depurando una imagen que nunca se reconstruyó.

**Filtrá por errores, no truncues por posición.** Si el filtro sale vacío, eso sí es
evidencia; `tail` no lo es.

```bash
dotnet build -c Release 2>&1 | grep -E ": error" | head -3   # vacío = limpio
docker compose build api 2>&1 | grep -E "error|failed" | head
```

## Meta Commands (siempre rtk directo)

```bash
rtk gain              # Analítica de ahorro de tokens
rtk gain --history    # Historial de comandos con ahorro
rtk discover          # Analiza el historial y detecta oportunidades perdidas
rtk proxy <cmd>       # Ejecuta comando crudo sin filtrar (debug)
```

## Verificación de instalación

```bash
rtk --version         # Debe mostrar: rtk X.Y.Z
which rtk             # Verificar binario correcto (/opt/homebrew/bin/rtk)
```

⚠️ **Colisión de nombre**: si `rtk gain` falla, puede que tengas
reachingforthejack/rtk (Rust Type Kit) en su lugar.

## Hook (fallback, no confiable)

Existe un hook `PreToolUse` (`command -v rtk && rtk hook claude`) que *intenta* reescribir
comandos automáticamente. En este harness el `updatedInput` no se aplica, así que tratalo
como best-effort: **no reemplaza el uso explícito**.

## Nota sobre adherencia

No hay objetivo numérico de adherencia a RTK, a propósito. Medido en agosto 2026, la
adherencia real era del 13,9% — y buena parte de esa brecha era el agente **evitando
correctamente** `rtk find` / `rtk grep`. Un objetivo de adherencia habría empujado hacia
la búsqueda que miente. La métrica queda como diagnóstico, no como gate.
