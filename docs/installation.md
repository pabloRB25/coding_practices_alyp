# Instalación

Este repo distribuye su ecosistema (skills + agentes) de tres formas, las tres
**cross-platform** (macOS · Linux · Windows). Elegí según quién sos: un equipo
que **consume** el estándar (vías 1 y 2), o alguien que **desarrolla** el
ecosistema mismo (vía 2 con `--link`, o vía 3 puntual).

---

## Vía 1 — Plugin de Claude Code (recomendada, especialmente en Windows)

La forma más simple de adoptar el ecosistema completo en Claude Code, sin clonar
el repo a mano ni preocuparse por diferencias de shell entre sistemas operativos.

```
/plugin marketplace add alyp-studio/coding_practices_alyp
/plugin install alyp-dev-standards@alyp-studio
```

Esto registra el marketplace `alyp-studio` (`.claude-plugin/marketplace.json`) e
instala el plugin `alyp-dev-standards` (`.claude-plugin/plugin.json`), que empaqueta
los 8 skills y los 4 agentes del ecosistema. Es la vía recomendada por defecto en
**cualquier** plataforma — el mecanismo `/plugin` es nativo de Claude Code e
idéntico en macOS, Linux y Windows: no requiere `git clone`, no requiere Node ni
un shell POSIX, y las actualizaciones futuras del plugin llegan por el mismo
mecanismo de `/plugin`.

**Importante — qué NO cablea el plugin**: el plugin instala skills y agentes,
pero **no** cablea los artefactos runtime de `alyp-token-savings` (statusline de
contexto, hook `context-guard`, keys en `~/.claude/settings.json`). Ese cableado
lo hace únicamente el instalador de la Vía 2 (`node scripts/install.mjs`), porque
necesita escribir en `settings.json` del usuario — algo que un plugin no hace por
vos. Si solo instalaste vía plugin y querés también el ahorro de tokens, corré
la Vía 2 (podés correrla igual sin clonar el repo entero si ya tenés el plugin:
cloná el repo puntualmente o pedile a alguien del equipo que corra el script una
vez y comparta el `settings.json` resultante).

---

## Vía 2 — Script de instalación

Para quienes prefieren clonar el repo (o ya lo tienen clonado como referencia)
y quieren un instalador explícito, o necesitan el cableado de `alyp-token-savings`
que la Vía 1 no cubre.

```bash
git clone https://github.com/alyp-studio/coding_practices_alyp.git
cd coding_practices_alyp
node scripts/install.mjs
```

El instalador (`scripts/install.mjs`) es un script de Node **cross-platform**:
corre igual en macOS, Linux y Windows, sin depender de bash ni de Python para
instalar skills y agentes. Los shims `./scripts/install.sh` (Unix — bash) y
`.\scripts\install.ps1` (Windows — PowerShell) son atajos finos que solo invocan
`node scripts/install.mjs "$@"`; no duplican lógica, así que usar uno u otro da
exactamente el mismo resultado.

```powershell
# Windows (PowerShell)
node scripts/install.mjs
# o el shim equivalente:
.\scripts\install.ps1
```

`scripts/install.mjs` soporta:

| Flag | Default | Qué hace |
|---|---|---|
| `--copy` | sí (default) | Copia `skills/` y `agents/` a destino. Para equipos externos: cada máquina tiene su propia copia, independiente de este repo. |
| `--link` | no | Crea symlinks al repo en vez de copiar (junction en directorios en Windows, symlink en Unix; si el symlink de archivo falla en Windows por falta de Developer Mode, cae a copia automáticamente). Pensado para quien **desarrolla el ecosistema**: cero drift entre el repo y lo instalado — cualquier edición en `skills/` se refleja al instante. |
| `--target DIR` | `~/.claude` | Cambia el destino de la instalación (por defecto instala en `~/.claude/skills/` y `~/.claude/agents/`; en Windows, `~/.claude` es `%USERPROFILE%\.claude`). |

Ejemplo para desarrollo del propio ecosistema:

```bash
node scripts/install.mjs --link
```

El script instala los 8 skills completos (`alyp-new-project`, `alyp-agentic-standards`,
`agentic-logging`, `alyp-observability`, `alyp-qa-standard`, `devstral-orchestration`,
`alyp-maestro`, `alyp-token-savings`) y los 4 agentes (`consultor`, `explorador`,
`implementador`, `revisor`). Además, si el skill `alyp-token-savings` está presente,
el instalador intenta cablear su statusline y su hook en `~/.claude/settings.json`
(ver "Requisitos por plataforma" más abajo — necesita Python 3; si no lo encuentra,
avisa y saltea ese paso sin fallar la instalación del resto).

---

## Vía 3 — Manual

Para instalar un subconjunto puntual, o en un entorno donde no se puede correr
el script.

**Importante**: copiá el directorio **completo** de cada skill, nunca solo el
`SKILL.md`. Los assets, referencias y templates (`assets/`, `references/`,
`templates/`) son parte del skill — un `SKILL.md` suelto, sin sus archivos
acompañantes, produce un skill roto o incompleto.

Ejemplo en bash (macOS/Linux, o Windows con Git Bash instalado — ver "Requisitos
por plataforma"; en PowerShell nativo el equivalente es `Copy-Item -Recurse`):

```bash
# Ejemplo: instalar solo el estándar de logging
cp -R skills/agentic-logging ~/.claude/skills/agentic-logging

# Ejemplo: instalar el ecosistema completo a mano
mkdir -p ~/.claude/skills ~/.claude/agents
cp -R skills/alyp-new-project        ~/.claude/skills/
cp -R skills/alyp-agentic-standards  ~/.claude/skills/
cp -R skills/agentic-logging         ~/.claude/skills/
cp -R skills/alyp-observability      ~/.claude/skills/
cp -R skills/alyp-qa-standard        ~/.claude/skills/
cp -R skills/devstral-orchestration  ~/.claude/skills/
cp -R skills/alyp-maestro            ~/.claude/skills/
cp -R skills/alyp-token-savings      ~/.claude/skills/
cp    agents/*.md                    ~/.claude/agents/
```

En Vía 3 el cableado de `alyp-token-savings` (statusline/hook/`settings.json`)
queda 100% manual — no hay script que lo haga por vos; ver el `SKILL.md` del
skill para el detalle de qué archivos copiar y qué keys agregar.

---

## Post-instalación

### `capacity.yaml` (requerido por el skill de orquestación)

`devstral-orchestration` necesita un archivo de capacidad del entorno en
`~/.claude/capacity.yaml`. El instalador (vía 2) lo crea automáticamente desde
`skills/devstral-orchestration/capacity.example.yaml` si no existe. En instalación
manual (vía 3) o si el skill se instaló solo, copialo y editalo a mano:

```bash
cp skills/devstral-orchestration/capacity.example.yaml ~/.claude/capacity.yaml
```

Editá `~/.claude/capacity.yaml` con el mapeo tier→modelo y los límites reales de
tu máquina/equipo (ver comentarios del archivo). El protocolo (`contracts/orchestration.md`)
es agnóstico de modelos concretos; este archivo es lo que lo hace concreto en tu entorno.

### Qué es opcional

- **Ejecutor local (Ollama) y hooks de QA automático**: `devstral-orchestration`
  funciona sin ellos. Si tu entorno no tiene ejecutor local, declarás
  `local.disponible: false` en `capacity.yaml` y el protocolo degrada: las tareas
  mecánicas se enrutan al tier barato (cloud) en vez de al ejecutor local. Si no
  tenés hooks de QA instalados, el veredicto de evidencia lo pide quien delega —
  no es un error del trabajo, es un modo de operación previsto.
- **`alyp-maestro`**: es el skill de curaduría de conocimiento local por proyecto.
  No es requisito de ningún otro skill del ecosistema; se adopta cuando el equipo
  quiere que Claude destile aprendizajes en skills locales versionadas del repo
  cliente.
- **`alyp-token-savings`**: es el skill de ahorro de tokens (statusline + hook de
  contexto). No es requisito de ningún otro skill; ver "Requisitos por plataforma"
  para su dependencia de Python 3.

---

## Requisitos por plataforma

Requisitos para **instalar y mantener** el ecosistema (distintos de los
requisitos para usar `alyp-new-project` — ver la sección siguiente).

| Requisito | Para qué | Notas |
|---|---|---|
| `node >= 20.11` | Correr el instalador (`scripts/install.mjs`), `scripts/check-drift.mjs` y la meta-QA (`scripts/lint-skills.mjs`, `scripts/canary.mjs`) | Cross-platform: la misma versión de Node sirve en macOS, Linux y Windows. La Vía 1 (plugin) no necesita Node. |
| **Git for Windows (Git Bash)** — solo Windows | Que la herramienta Bash de Claude Code (usada por los skills que corren `cp`, `grep`, `pnpm`, etc.) funcione | Claude Code usa Git Bash como intérprete de su herramienta Bash si lo detecta instalado; si no lo detecta, cae a PowerShell y los comandos POSIX que los skills invocan fallan. Si tenés Git for Windows instalado pero Claude Code no lo detecta, configurá `CLAUDE_CODE_GIT_BASH_PATH` apuntando al `bash.exe` en `settings.json`. |
| **Python 3** (`python`, `py` o `python3` en el PATH) — solo si usás `alyp-token-savings` | Correr la statusline de contexto y el hook `context-guard` | Opcional: si el instalador (Vía 2) no encuentra Python 3, cablea el resto de la instalación igual y avisa que saltea el statusline/hook — no falla la instalación completa. |

Nota de rutas en Windows: `~/.claude` es `%USERPROFILE%\.claude` (típicamente
`C:\Users\<usuario>\.claude`). Todos los ejemplos de este documento que muestran
`~/.claude` asumen esa equivalencia en Windows.

---

## Actualización

**Vía plugin**: re-correr `/plugin install alyp-dev-standards@alyp-studio` (o el
mecanismo de actualización de plugins de Claude Code) trae la versión más nueva.

**Vía script/manual, modo `--copy`**:

```bash
cd coding_practices_alyp
git pull
node scripts/install.mjs          # re-copia skills y agentes actualizados
```

**Vía script, modo `--link`**: no hace falta re-instalar — los symlinks/junctions
apuntan al repo, así que un `git pull` ya deja lo instalado al día.

**Verificar que no hay drift** entre lo que hay en el repo y lo instalado
(útil sobre todo en modo `--copy`, donde es fácil olvidarse de re-instalar):

```bash
node scripts/check-drift.mjs
# → exit 0, sin salida = todo al día
# → "FALTA: <skill>" = un skill del repo no está instalado
# → "DRIFT: <skill> difiere..." = la copia instalada quedó desactualizada
```

`scripts/check-drift.mjs` es igual de cross-platform que el instalador (y tiene
los mismos shims, `./scripts/check-drift.sh` y `.\scripts\check-drift.ps1`).
Ignora los skills instalados como symlink/junction (modo `--link`), porque esos
nunca pueden tener drift.

---

## Prerequisitos del sistema (para `alyp-new-project`)

Estos son requisitos aparte, no para instalar el ecosistema sino para **usar**
`alyp-new-project` (el orquestador de scaffolding) una vez instalado — verificar
antes de invocarlo:

| Herramienta | Versión mínima | Para qué |
|-------------|----------------|---------|
| `node` | >= 22 | Runtime de Next.js |
| `pnpm` | >= 9 | Package manager |
| `gh` CLI | cualquiera | Crear repos, secrets, branch protection |
| `vercel` CLI | cualquiera | Crear proyectos, linkear GitHub |
| `supabase` CLI | cualquiera | Crear proyectos, migraciones, gen tipos |
| `git` | cualquiera | Control de versiones |

Verificar autenticación:

```bash
gh auth status        # debe mostrar cuenta activa
vercel whoami         # debe mostrar tu cuenta de Vercel
supabase --version    # solo verifica que está instalado
```
