# RTK - Rust Token Killer <!-- Poda 2026-11: secciones largas comprimidas; evidencias fechadas en comentarios. -->

Proxy CLI optimizado en tokens (60-90% de ahorro en operaciones de dev).

- Usalo explícito, también en subagentes: el hook `PreToolUse` (`rtk hook claude`) no reescribe de forma confiable en este harness (cobertura ~0.9%). Si el comando ya empieza con `rtk`, no lo dupliques.
- Nunca `rtk find` ni `rtk grep`: dan falsos negativos, y una búsqueda que miente hace concluir "no existe" sobre algo que sí está. Buscá con `find`/`fd`/Glob, `grep -rn`/Grep, `ast-grep` o Serena; si ya corriste uno y dio 0, reconfirmá con la herramienta plana. <!-- 2026-07-16: rtk find de *monitor* y *capacity* en ~/.claude dio 0; find plano encontró monitor.sh, ollama-monitor.py y capacity.yaml. 2026-08-12: rtk grep de alyp\.studio en ~/Dev/alyp-studio/alypstudio dio vacío; grep -rn encontró 20+ coincidencias. rtk read/ls/git no mostraron el problema. -->
- Nunca truncar la salida por posición (`| tail`): filtrá por errores (`2>&1 | grep -E ": error"`). Un filtro vacío es evidencia; `tail` no. <!-- 2026-08-07 (CJK): un build por | tail mostró Container Started y Time Elapsed mientras fallaba; varios ciclos depurando una imagen que nunca se reconstruyó. -->
- `tokei`, `hyperfine`, `mise`, `direnv`, `delta` y `ast-grep` corren sin `rtk`. Los que modifican estado (`ast-grep` con rewrite, `fd --exec`, `hyperfine`, `direnv allow`, `mise install`) requieren aprobación explícita, nunca comodines amplios. <!-- Sin objetivo numérico de adherencia a propósito: en ago-2026 era 13,9%, y buena parte de la brecha era evitar correctamente rtk find/grep. -->

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

## Meta commands y verificación de instalación

```bash
rtk gain              # Analítica de ahorro de tokens
rtk gain --history    # Historial de comandos con ahorro
rtk discover          # Detecta oportunidades perdidas en el historial
rtk proxy <cmd>       # Ejecuta el comando crudo sin filtrar (debug)
rtk --version         # Debe mostrar: rtk X.Y.Z
which rtk             # Binario correcto: /opt/homebrew/bin/rtk
```

Si `rtk gain` falla, puede que tengas reachingforthejack/rtk (Rust Type Kit) en su lugar.
