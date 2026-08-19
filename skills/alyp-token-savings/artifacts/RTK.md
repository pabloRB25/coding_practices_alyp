# RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations).

> ⚠️ **USALO EXPLÍCITAMENTE, SIEMPRE.** El hook `PreToolUse` NO reescribe los
> comandos de forma confiable en este harness (verificado: cobertura ~0.9%).
> Por lo tanto: **prependé `rtk` a mano** en todo comando de lectura/búsqueda/
> build/status. No confíes en el hook. Esto aplica al agente principal Y a los
> subagentes (implementador, explorador, revisor).

## Regla operativa

Antes de correr un comando de dev, usá su equivalente `rtk`. Si el comando ya
empieza con `rtk`, no lo dupliques.

| En vez de… | Usá… | Ahorro típico |
|-----------|------|---------------|
| `grep -n <p>` / `grep -rn` | `rtk grep <p>` | ~alto |
| `cat <file>` / `cat -n` | `rtk read <file>` | medio |
| `ls -la` | `rtk ls` | medio |
| `find . -name` | `rtk find -name` | alto |
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

Regla general: **`rtk <herramienta> <args>`**. Cubre lectura de archivos,
búsquedas, listados, status/diff de git, instalación/scripts de npm, tests,
lint y builds — que es donde se va el grueso de los tokens de tooling.

## Navegación especializada (fuera de RTK)

Usá esta progresión y detenete tan pronto como obtengas evidencia suficiente:

1. `rtk find` o `fd` para localizar archivos por nombre/ruta.
2. `rtk grep` para texto, nombres, imports o cadenas conocidas.
3. `ast-grep` (`sg`) para patrones sintácticos, llamadas y estructuras AST.
4. Serena para símbolos, definiciones, referencias y relaciones entre archivos.
5. Leé solamente los archivos o rangos que devolvió la búsqueda.

Herramientas auxiliares:

- `tokei`: dimensionar lenguajes y tamaño de un repo antes de explorarlo.
- `hyperfine`: comparar rendimiento solo cuando la tarea pida benchmarking.
- `mise` / `direnv`: detectar y activar el entorno declarado por el proyecto.
- `delta`: salida visual para humanos; para el agente preferí `rtk git diff`.

Estas herramientas se ejecutan **directamente**, sin prefijo `rtk`: RTK no las
proxifica. `ast-grep` con rewrite/update, `fd --exec`, `hyperfine`,
`direnv allow` y `mise install` pueden ejecutar o modificar estado; requieren
aprobación explícita y nunca deben quedar preautorizados con comodines amplios.

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

Existe un hook `PreToolUse` (`command -v rtk && rtk hook claude`) que *intenta*
reescribir comandos automáticamente. En este harness el `updatedInput` no se
aplica, así que trátalo como best-effort: **no reemplaza el uso explícito**.
Correr `rtk discover` periódicamente muestra cuánto se está dejando sin optimizar.
