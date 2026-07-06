# Instalación

Este repo distribuye su ecosistema (skills + agentes) de tres formas. Elegí según
quién sos: un equipo que **consume** el estándar (vías 1 y 2), o alguien que
**desarrolla** el ecosistema mismo (vía 2 con `--link`, o vía 3 puntual).

---

## Vía 1 — Plugin de Claude Code (recomendada para equipos)

La forma más simple de adoptar el ecosistema completo en Claude Code, sin clonar
el repo a mano.

```
/plugin marketplace add alyp-studio/coding_practices_alyp
/plugin install alyp-dev-standards@alyp-studio
```

Esto registra el marketplace `alyp-studio` (`.claude-plugin/marketplace.json`) e
instala el plugin `alyp-dev-standards` (`.claude-plugin/plugin.json`), que empaqueta
los 7 skills y los 4 agentes del ecosistema. Es la vía recomendada por defecto:
no requiere `git clone` ni gestionar rutas, y las actualizaciones futuras del
plugin llegan por el mismo mecanismo de `/plugin`.

---

## Vía 2 — Script de instalación

Para quienes prefieren clonar el repo (o ya lo tienen clonado como referencia)
y quieren un instalador explícito.

```bash
git clone https://github.com/alyp-studio/coding_practices_alyp.git
cd coding_practices_alyp
./scripts/install.sh
```

`scripts/install.sh` soporta:

| Flag | Default | Qué hace |
|---|---|---|
| `--copy` | sí (default) | Copia `skills/` y `agents/` a destino. Para equipos externos: cada máquina tiene su propia copia, independiente de este repo. |
| `--link` | no | Crea symlinks al repo en vez de copiar. Pensado para quien **desarrolla el ecosistema**: cero drift entre el repo y lo instalado — cualquier edición en `skills/` se refleja al instante. |
| `--target DIR` | `~/.claude` | Cambia el destino de la instalación (por defecto instala en `~/.claude/skills/` y `~/.claude/agents/`). |

Ejemplo para desarrollo del propio ecosistema:

```bash
./scripts/install.sh --link
```

El script instala los 7 skills completos (`alyp-new-project`, `alyp-agentic-standards`,
`agentic-logging`, `alyp-observability`, `alyp-qa-standard`, `devstral-orchestration`,
`alyp-maestro`) y los 4 agentes (`consultor`, `explorador`, `implementador`, `revisor`).

---

## Vía 3 — Manual

Para instalar un subconjunto puntual, o en un entorno donde no se puede correr
el script.

**Importante**: copiá el directorio **completo** de cada skill, nunca solo el
`SKILL.md`. Los assets, referencias y templates (`assets/`, `references/`,
`templates/`) son parte del skill — un `SKILL.md` suelto, sin sus archivos
acompañantes, produce un skill roto o incompleto.

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
cp    agents/*.md                    ~/.claude/agents/
```

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

---

## Actualización

**Vía plugin**: re-correr `/plugin install alyp-dev-standards@alyp-studio` (o el
mecanismo de actualización de plugins de Claude Code) trae la versión más nueva.

**Vía script/manual, modo `--copy`**:

```bash
cd coding_practices_alyp
git pull
./scripts/install.sh          # re-copia skills y agentes actualizados
```

**Vía script, modo `--link`**: no hace falta re-instalar — los symlinks apuntan
al repo, así que un `git pull` ya deja lo instalado al día.

**Verificar que no hay drift** entre lo que hay en el repo y lo instalado
(útil sobre todo en modo `--copy`, donde es fácil olvidarse de re-instalar):

```bash
./scripts/check-drift.sh
# → sin salida = todo al día
# → "FALTA: <skill>" = un skill del repo no está instalado
# → "DRIFT: <skill> difiere..." = la copia instalada quedó desactualizada
```

`check-drift.sh` ignora los skills instalados como symlink (modo `--link`), porque
esos nunca pueden tener drift.

---

## Prerequisitos del sistema

Antes de invocar `alyp-new-project` (el orquestador de scaffolding), verificar:

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
