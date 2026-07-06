# Ecosistema de skills v2 — agnóstico + instalador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `coding_practices_alyp` en la fuente de verdad versionada de los 7 skills de desarrollo Alyp (con contratos agnósticos separados de la implementación) y en un instalador que cualquier equipo pueda usar (plugin de Claude Code + script).

**Architecture:** Tres capas — (1) `contracts/` con los invariantes versionados de cada estándar (el "qué", agnóstico de stack); (2) `skills/` con los 7 skills completos (el "cómo", perfil next·supabase·vercel) + `agents/` con los 4 subagentes; (3) instalación por symlink (nuestro equipo, cero drift) o copia/plugin (equipos externos). Un lint estructural de skills + un canario en CI hacen de meta-QA del propio ecosistema.

**Tech Stack:** Bash, Node ≥ 22 (scripts `.mjs` sin dependencias), YAML/JSON, GitHub Actions, formato de plugins de Claude Code.

## Global Constraints

- Repo de trabajo: `/Users/parb/Dev/alyp-studio/coding_practices_alyp`, rama `develop`. Nunca commitear a `main` directo.
- La fuente viva actual de los skills es `~/.claude/skills/` — al importar al repo, NO editar el contenido durante la importación (importar verbatim; las mejoras son tareas posteriores).
- Dominio, logs y códigos de error **en español** — es decisión de estándar Alyp (CLAUDE.md global). El schema de logging v1 con claves en español queda **congelado como contrato**; NO traducir claves.
- NO renombrar skills ni agentes (romperían CLAUDE.md global, memorias y referencias cruzadas). El prefijo `alyp-` se mantiene como marca.
- Los assets de `agentic-logging` se copian verbatim SIEMPRE (regla del propio skill) — ningún script debe regenerarlos.
- Scripts nuevos: Node `.mjs` sin dependencias npm (deben correr con `node` pelado) o Bash con `set -euo pipefail`.
- Todo mensaje de commit en español, prefijo convencional (`feat:`, `fix:`, `docs:`, `chore:`).
- Cada tarea termina con su verificación ejecutada y su commit — nada queda "hecho" sin evidencia.

## Estructura de archivos final

```
coding_practices_alyp/
├── .claude-plugin/
│   ├── plugin.json               # paquete plugin Claude Code
│   └── marketplace.json          # marketplace propio (alyp-studio)
├── contracts/                    # capa 1: contratos agnósticos versionados
│   ├── code-standard.md          # agentic-standard v1 (invariantes)
│   ├── qa-standard.md            # qa-standard v1 (6 principios + oráculos)
│   ├── logging-standard.md       # logging-standard v1 (3 reglas + schema congelado)
│   ├── orchestration.md          # protocolo por tiers abstractos
│   ├── env-vars.md               # tabla única de env vars con dueño
│   ├── manifest.md               # contrato del manifiesto por repo
│   ├── standards.example.yaml    # template del manifiesto
│   └── evidencia.schema.json     # sobre único de evidencia
├── skills/                       # capa 2: los 7 skills COMPLETOS (dirs con assets)
│   ├── alyp-new-project/ ...
│   ├── alyp-agentic-standards/ ...
│   ├── agentic-logging/ ...
│   ├── alyp-observability/ ...
│   ├── alyp-qa-standard/ ...
│   ├── devstral-orchestration/ ... (incluye capacity.example.yaml)
│   └── alyp-maestro/ ...
├── agents/                       # implementador, explorador, revisor, consultor
├── scripts/
│   ├── install.sh                # instalador (--copy | --link | --target)
│   ├── check-drift.sh            # detecta drift repo ↔ instalado
│   ├── lint-skills.mjs           # meta-QA estructural (frontmatter, deps, assets)
│   └── canary.sh                 # meta-QA funcional (assets compilan, lint dispara)
├── canary/
│   └── fixture/                  # proyecto mínimo para el canario
├── .github/workflows/canary.yml  # canario en CI al tocar skills/ o contracts/
├── docs/ (installation.md re-escrito, adopcion-equipos.md nuevo)
├── CHANGELOG.md                  # entrada v2.0.0
└── README.md                     # re-escrito a 3 capas
```

---

## FASE A — Repo como fuente de verdad (equipo óptimo)

### Task 1: Importar los 7 skills completos y los 4 agentes al repo

**Files:**
- Delete: `skills/alyp-new-project.md`, `skills/alyp-observability.md`, `skills/alyp-agentic-standards.md`, `skills/agentic-logging.md`, `skills/README.md`
- Create: `skills/<los 7 dirs completos>` (verbatim desde `~/.claude/skills/`)
- Create: `agents/{implementador,explorador,revisor,consultor}.md` (verbatim desde `~/.claude/agents/`)

**Interfaces:**
- Produces: `skills/<nombre>/SKILL.md` × 7 con sus `assets/`, `references/`, `templates/`, `versions/` — base que TODAS las tareas siguientes editan. Ninguna tarea posterior debe editar `~/.claude/skills/` directamente.

- [ ] **Step 1: Borrar los snapshots planos desactualizados**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
git rm skills/alyp-new-project.md skills/alyp-observability.md \
       skills/alyp-agentic-standards.md skills/agentic-logging.md skills/README.md
```

- [ ] **Step 2: Importar los 7 skills verbatim (sin editar contenido)**

```bash
for s in alyp-new-project alyp-agentic-standards agentic-logging \
         alyp-observability alyp-qa-standard devstral-orchestration alyp-maestro; do
  rsync -a --exclude '.DS_Store' ~/.claude/skills/"$s"/ skills/"$s"/
done
mkdir -p agents
rsync -a --exclude '.DS_Store' ~/.claude/agents/ agents/
```

- [ ] **Step 3: Verificar la importación**

```bash
ls skills/*/SKILL.md | wc -l    # Expected: 7
ls agents/*.md | wc -l          # Expected: 4
diff -rq ~/.claude/skills/agentic-logging skills/agentic-logging   # Expected: sin salida
```

- [ ] **Step 4: Commit**

```bash
git add -A skills/ agents/
git commit -m "feat: importar los 7 skills completos y 4 agentes como fuente de verdad (v2 base)"
```

### Task 2: Instalador `install.sh` + modo dev por symlink en nuestra máquina

**Files:**
- Create: `scripts/install.sh`
- Create: `scripts/check-drift.sh`

**Interfaces:**
- Produces: `scripts/install.sh [--link|--copy] [--target DIR]` — usado por docs (Task 13) y por equipos externos. `check-drift.sh` sale con código 1 si hay drift.

- [ ] **Step 1: Escribir `scripts/install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Instalador del ecosistema de skills Alyp.
#   --copy  (default) copia skills/ y agents/ al target — para equipos externos
#   --link  symlinks al repo — para desarrollo del ecosistema (cero drift)
#   --target DIR  destino (default: ~/.claude)

MODE="copy"
TARGET="$HOME/.claude"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --link) MODE="link"; shift ;;
    --copy) MODE="copy"; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    *) echo "arg desconocido: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$TARGET/skills" "$TARGET/agents"
SKILLS=(alyp-new-project alyp-agentic-standards agentic-logging \
        alyp-observability alyp-qa-standard devstral-orchestration alyp-maestro)

for s in "${SKILLS[@]}"; do
  dest="$TARGET/skills/$s"
  if [[ "$MODE" == "link" ]]; then
    [[ -e "$dest" && ! -L "$dest" ]] && rm -rf "$dest"
    ln -sfn "$REPO_DIR/skills/$s" "$dest"
  else
    rm -rf "$dest"
    cp -R "$REPO_DIR/skills/$s" "$dest"
  fi
  echo "✓ skill $s ($MODE)"
done

for a in "$REPO_DIR"/agents/*.md; do
  name="$(basename "$a")"
  if [[ "$MODE" == "link" ]]; then
    ln -sfn "$a" "$TARGET/agents/$name"
  else
    cp "$a" "$TARGET/agents/$name"
  fi
  echo "✓ agente $name ($MODE)"
done

cap_example="$REPO_DIR/skills/devstral-orchestration/capacity.example.yaml"
if [[ -f "$cap_example" && ! -f "$TARGET/capacity.yaml" ]]; then
  cp "$cap_example" "$TARGET/capacity.yaml"
  echo "✓ capacity.yaml creado desde example — editalo con los modelos/límites de tu entorno"
fi

echo "Instalación completa ($MODE) en $TARGET"
```

Nota: `capacity.example.yaml` se crea en Task 11; el bloque `if [[ -f` lo hace opcional hasta entonces.

- [ ] **Step 2: Escribir `scripts/check-drift.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$HOME/.claude}"
rc=0
for d in "$REPO_DIR"/skills/*/; do
  s="$(basename "$d")"
  inst="$TARGET/skills/$s"
  if [[ -L "$inst" ]]; then continue; fi
  if [[ ! -d "$inst" ]]; then echo "FALTA: $s no instalado"; rc=1; continue; fi
  if ! diff -rq "$d" "$inst" >/dev/null 2>&1; then
    echo "DRIFT: $s difiere entre repo e instalado:"
    diff -rq "$d" "$inst" | head -10
    rc=1
  fi
done
exit $rc
```

- [ ] **Step 3: Dar permisos y probar `--link` en un target temporal (test antes de tocar lo real)**

```bash
chmod +x scripts/install.sh scripts/check-drift.sh
TMP=$(mktemp -d)
./scripts/install.sh --link --target "$TMP"
readlink "$TMP/skills/agentic-logging"   # Expected: .../coding_practices_alyp/skills/agentic-logging
./scripts/check-drift.sh "$TMP"; echo "drift rc=$?"   # Expected: rc=0 (symlinks se saltan)
rm -rf "$TMP"
```

- [ ] **Step 4: Instalar en modo `--link` en la máquina real y verificar que Claude Code carga los skills**

```bash
./scripts/install.sh --link
ls -l ~/.claude/skills/ | grep '\->' | wc -l   # Expected: 7 symlinks
```

Verificación funcional: abrir una sesión nueva de `claude` y confirmar que los 7 skills aparecen en la lista de skills disponibles (p. ej. invocar `alyp-maestro` en dry-run). **Si Claude Code no siguiera los symlinks** (skills no listados): rollback a `./scripts/install.sh --copy` y agregar `scripts/check-drift.sh` como verificación manual post-edición; documentar la limitación en `docs/installation.md` (Task 13).

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh scripts/check-drift.sh
git commit -m "feat: instalador install.sh (--copy/--link) + check-drift; equipo local en modo link"
```

### Task 3: Versionado del ecosistema

**Files:**
- Modify: `CHANGELOG.md` (prepend entrada v2.0.0)
- Modify: `skills/*/SKILL.md` × 7 (agregar `version:` al frontmatter)

**Interfaces:**
- Produces: campo `version:` en el frontmatter de cada SKILL.md (lo valida `lint-skills.mjs` de Task 4). Esquema: semver por skill; el ecosistema completo se etiqueta con git tag `v2.0.0` al final del plan (Task 15).

- [ ] **Step 1: Agregar `version:` al frontmatter de cada skill**

En cada `skills/<nombre>/SKILL.md`, dentro del bloque `---`, agregar una línea después de `name:`. Versiones iniciales (reflejan historia real):

| Skill | línea a agregar |
|---|---|
| alyp-new-project | `version: 1.1.0` |
| alyp-agentic-standards | `version: 1.1.0` |
| agentic-logging | `version: 1.1.0` |
| alyp-observability | `version: 1.1.0` |
| alyp-qa-standard | `version: 1.0.0` |
| devstral-orchestration | `version: 2.5.0` |
| alyp-maestro | `version: 1.0.0` |

- [ ] **Step 2: Prepend al CHANGELOG.md**

```markdown
# Changelog

## v2.0.0 — 2026-07-06 (en curso)

### El repo pasa a ser fuente de verdad + instalador

- Los 7 skills completos (con assets/references/templates) viven en `skills/`; `~/.claude/skills/` es una instalación (symlink en dev, copia en equipos).
- Capa `contracts/`: invariantes agnósticos versionados, separados del perfil de stack next·supabase·vercel.
- Manifiesto de estándares por repo (`standards.yaml`) + sello `logging-standard: v1`.
- QA cableado como FASE 5.8 de alyp-new-project; FASE 5.5 deja de ser placeholder.
- devstral-orchestration v2.6: tiers abstractos + `capacity.yaml` por máquina.
- Instalador `scripts/install.sh` + empaquetado como plugin de Claude Code.
- Meta-QA: `lint-skills.mjs` + canario en CI.
```

(mantener debajo la entrada v1 existente)

- [ ] **Step 3: Verificar y commitear**

```bash
grep -l '^version:' skills/*/SKILL.md | wc -l   # Expected: 7
git add skills/ CHANGELOG.md
git commit -m "chore: versionado por skill (frontmatter) + CHANGELOG v2.0.0"
```

---

## FASE B — Quick wins de mejoras

### Task 4: Dependencias máquina-leíbles + lint estructural de skills (meta-QA capa 1)

**Files:**
- Modify: `skills/*/SKILL.md` × 7 (frontmatter `requires:`/`provides:`)
- Create: `scripts/lint-skills.mjs`

**Interfaces:**
- Consumes: frontmatter `version:` (Task 3).
- Produces: `node scripts/lint-skills.mjs [dir]` — exit 0/1; valida: frontmatter completo (`name`, `description`, `version`), todo `requires:` resuelto por el `provides:`/`name` de otro skill, y que toda ruta `assets/`, `references/`, `templates/` mencionada en el SKILL.md exista en disco. Lo consume el canario (Task 14).

- [ ] **Step 1: Agregar `requires:`/`provides:` al frontmatter**

| Skill | agregar al frontmatter |
|---|---|
| alyp-new-project | `requires: [alyp-agentic-standards, alyp-observability, alyp-qa-standard]` |
| alyp-agentic-standards | `provides: [code-standard]` y `requires: [agentic-logging]` |
| agentic-logging | `provides: [logging-standard, traceid-contract]` |
| alyp-observability | `provides: [observability]` y `requires: [agentic-logging]` |
| alyp-qa-standard | `provides: [qa-standard]` y `requires: [traceid-contract]` |
| devstral-orchestration | `provides: [orchestration]` |
| alyp-maestro | `provides: [curaduria]` |

- [ ] **Step 2: Escribir `scripts/lint-skills.mjs`**

```javascript
#!/usr/bin/env node
// Meta-QA estructural: valida frontmatter, grafo requires/provides y assets referenciados.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..', 'skills');
const errores = [];
const skills = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
const provistos = new Set();
const requeridos = [];

for (const dir of skills) {
  const ruta = join(root, dir, 'SKILL.md');
  if (!existsSync(ruta)) { errores.push(`${dir}: falta SKILL.md`); continue; }
  const texto = readFileSync(ruta, 'utf8');
  const fm = texto.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { errores.push(`${dir}: sin frontmatter`); continue; }
  const meta = fm[1];
  for (const campo of ['name:', 'description:', 'version:']) {
    if (!meta.includes(campo)) errores.push(`${dir}: frontmatter sin ${campo.slice(0, -1)}`);
  }
  const nombre = (meta.match(/^name:\s*(\S+)/m) ?? [])[1];
  if (nombre) provistos.add(nombre);
  const prov = meta.match(/^provides:\s*\[([^\]]*)\]/m);
  if (prov) prov[1].split(',').forEach((p) => provistos.add(p.trim()));
  const req = meta.match(/^requires:\s*\[([^\]]*)\]/m);
  if (req) req[1].split(',').forEach((r) => requeridos.push({ dir, dep: r.trim() }));

  for (const m of texto.matchAll(/`?((?:assets|references|templates)\/[\w\-./]+\.[\w]+)`?/g)) {
    const rel = m[1];
    if (rel.includes('*') || rel.includes('<')) continue;
    if (!existsSync(join(root, dir, rel))) errores.push(`${dir}: referencia rota → ${rel}`);
  }
}

for (const { dir, dep } of requeridos) {
  if (!provistos.has(dep)) errores.push(`${dir}: requires "${dep}" que nadie provee`);
}

if (errores.length) {
  console.error(`✗ lint-skills: ${errores.length} problema(s)\n` + errores.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ lint-skills: ${skills.length} skills OK (${provistos.size} capacidades)`);
```

- [ ] **Step 3: Correr el lint — primero DEBE fallar o pasar por las razones correctas**

```bash
node scripts/lint-skills.mjs
```

Expected: exit 0 con `7 skills OK`. Si reporta `referencia rota`, son rutas de assets citadas en SKILL.md que no existen — corregir la referencia en el SKILL.md correspondiente (bug real encontrado, no silenciar el lint).

Test negativo (el lint detecta deps rotas):

```bash
TMP=$(mktemp -d); cp -R skills/alyp-qa-standard "$TMP/"; \
sed -i '' 's/requires: \[traceid-contract\]/requires: [inexistente]/' "$TMP/alyp-qa-standard/SKILL.md"; \
node scripts/lint-skills.mjs "$TMP"; echo "rc=$?"   # Expected: rc=1 y mensaje "que nadie provee"
rm -rf "$TMP"
```

- [ ] **Step 4: Commit**

```bash
git add skills/ scripts/lint-skills.mjs
git commit -m "feat: requires/provides en frontmatter + lint estructural de skills"
```

### Task 5: Manifiesto de estándares por repo + sello logging-standard

**Files:**
- Create: `contracts/manifest.md`
- Create: `contracts/standards.example.yaml`
- Modify: `skills/agentic-logging/SKILL.md` (instalar sello + manifiesto)

**Interfaces:**
- Produces: convención `standards.yaml` en la raíz de cada repo cliente; sello `logging-standard: v1`. La auditoría total = leer el manifiesto y correr el modo audit de cada skill en orden `requires`.

- [ ] **Step 1: Escribir `contracts/standards.example.yaml`**

```yaml
# standards.yaml — manifiesto de estándares Alyp adoptados por este repo.
# La auditoría lee este archivo y corre el modo audit de cada skill en orden de dependencias.
ecosistema: 2.0.0
perfil: next-supabase-vercel   # único perfil implementado hoy
estandares:
  code-standard: v1            # sello en CLAUDE.md: agentic-standard: v1
  logging-standard: v1
  qa-standard: v1
  observability: v1
excepciones: []                # ej: "- qa-standard: sin flujos P2 (app interna sin nocturno)"
```

- [ ] **Step 2: Escribir `contracts/manifest.md`**

```markdown
# Contrato: manifiesto de estándares (v1)

Cada repo que adopta el ecosistema declara **qué estándares sigue y en qué versión**
en `standards.yaml` (raíz del repo). Ver `standards.example.yaml`.

## Reglas

1. El manifiesto es la fuente de verdad de adopción — los sellos en CLAUDE.md
   (`agentic-standard: v1`, `qa-standard: v1`, `logging-standard: v1`) deben coincidir.
2. Toda excepción a un estándar se declara en `excepciones:` con su porqué. Excepción
   no declarada = incumplimiento, no excepción.
3. Auditoría total de un repo: leer `standards.yaml` → correr el modo audit de cada
   skill declarado, en orden de `requires:` (logging → code → observability → qa) →
   scorecard: cumple / cumple-con-excepciones / drift.
4. Actualizar de versión un estándar = correr el skill en modo audit con la versión
   nueva y actualizar manifiesto + sellos en el mismo PR.
```

- [ ] **Step 3: Agregar sello y manifiesto a la instalación de agentic-logging**

En `skills/agentic-logging/SKILL.md`, en la sección `## Steps (mode: bootstrap — new/clean project)`, agregar tras el paso 9 (antes de `10. **Verify**`):

```markdown
9b. Stamp the standard seal and manifest: append `<!-- logging-standard: v1 -->` to the
   project's `CLAUDE.md`, and add `logging-standard: v1` under `estandares:` in the
   repo's `standards.yaml` (create it from `contracts/standards.example.yaml` if missing).
```

Y en `## Verification (acceptance)` agregar el bullet:

```markdown
- `grep "logging-standard: v1" CLAUDE.md` and the repo's `standards.yaml` both confirm the seal.
```

- [ ] **Step 4: Verificar y commitear**

```bash
node scripts/lint-skills.mjs   # Expected: 7 skills OK (sin referencias rotas nuevas)
git add contracts/ skills/agentic-logging/SKILL.md
git commit -m "feat: contrato de manifiesto standards.yaml + sello logging-standard: v1"
```

### Task 6: Cablear QA en alyp-new-project + matar el placeholder de F5.5

**Files:**
- Create: `skills/alyp-new-project/references/fase-58-qa-standard.md`
- Modify: `skills/alyp-new-project/SKILL.md` (índice de fases + checklist)
- Modify: `skills/alyp-new-project/references/fase-55-observabilidad.md` (quitar PLACEHOLDER)
- Modify: `skills/alyp-new-project/references/checklist-final.md`

**Interfaces:**
- Consumes: skill `alyp-qa-standard` existente (sus 8 pasos de instalación).
- Produces: FASE 5.8 en el pipeline de creación; un proyecto nuevo sale con `qa/` scaffoldeado.

- [ ] **Step 1: Escribir `references/fase-58-qa-standard.md`**

```markdown
# FASE 5.8 — QA de flujos de negocio (delegado)

**Delega a**: skill `alyp-qa-standard` (instalación completa, pasos 1–8 de su SKILL.md).

**Objetivo**: el proyecto nace con el estándar de pruebas instalado: carpeta `qa/`
(config, catálogo, seeds, e2e Playwright, smoke agéntico), workflow CI `qa-e2e.yml`
y sello `qa-standard: v1`.

**Alcance en proyecto nuevo**: el catálogo arranca con 1 flujo P0 real (login o el
health-path de negocio mínimo) — NO inventar flujos que el producto aún no tiene.
El resto del catálogo se puebla feature a feature (runbook de `alyp-agentic-standards`).

**Ambientes**: `qa.config.yaml` apunta a DEV (Supabase dev de FASE 4, preview de
FASE 5). PROD queda `solo_lectura: true` desde el día 1.

**Gate — no avances si falla**: `qa/qa.config.yaml` existe con prod solo-lectura;
1 spec P0 pasa contra el ambiente dev (`pnpm --filter qa e2e`); workflow `qa-e2e.yml`
en `.github/workflows/`; sello `qa-standard: v1` en CLAUDE.md y en `standards.yaml`.
```

- [ ] **Step 2: Insertar la fase en el índice del SKILL.md**

En `skills/alyp-new-project/SKILL.md`, después del bloque de `### FASE 5.7 — Performance & Caching`, insertar:

```markdown
### FASE 5.8 — QA de flujos de negocio (delegado) → `references/fase-58-qa-standard.md`
**Delega a**: skill `alyp-qa-standard` — carpeta `qa/`, catálogo con 1 flujo P0 real, CI `qa-e2e.yml`, sello.
**Gate — no avances si falla**: spec P0 verde contra dev, prod `solo_lectura: true`, sello en CLAUDE.md + `standards.yaml`.
```

- [ ] **Step 3: Actualizar FASE 5.5 (ya no es placeholder)**

En `skills/alyp-new-project/SKILL.md`, reemplazar el texto de la FASE 5.5:

```markdown
### FASE 5.5 — Observabilidad (delegado) → `references/fase-55-observabilidad.md`
**Delega a**: skill `alyp-observability` (que a su vez invoca `agentic-logging` completo).
**Gate — no avances si falla**: checklist del skill cumplido; error de prueba en staging visible en el backend de logs en < 30 s con `traceId`, `archivo` y `linea`.
```

Y en `references/fase-55-observabilidad.md`, eliminar toda mención de "PLACEHOLDER" / "skill en construcción" y dejar: objetivo, delegación al skill, y el gate anterior.

- [ ] **Step 4: Agregar al checklist final**

En `references/checklist-final.md`, agregar en la sección de skills delegados:

```markdown
- [ ] FASE 5.8 — `alyp-qa-standard` instalado: `qa/` completo, 1 spec P0 verde, workflow `qa-e2e.yml`, sello `qa-standard: v1` + manifiesto
```

- [ ] **Step 5: Verificar y commitear**

```bash
node scripts/lint-skills.mjs                                    # Expected: OK
grep -c "FASE 5.8" skills/alyp-new-project/SKILL.md             # Expected: >= 1
grep -ci placeholder skills/alyp-new-project/references/fase-55-observabilidad.md  # Expected: 0
git add skills/alyp-new-project/
git commit -m "feat(new-project): FASE 5.8 QA cableada + FASE 5.5 sin placeholder"
```

### Task 7: Contrato de env vars (tabla única con dueño)

**Files:**
- Create: `contracts/env-vars.md`

**Interfaces:**
- Consumes: env vars documentadas hoy en agentic-logging (`assets/env.example`), alyp-observability (FASE 5) y alyp-new-project (FASE 5).
- Produces: tabla única que los skills referencian en vez de re-listar.

- [ ] **Step 1: Escribir `contracts/env-vars.md`**

```markdown
# Contrato: variables de entorno estándar (v1)

Tabla única. Cada variable tiene UN skill dueño (quien la define y documenta);
los demás solo la consumen. Al agregar una var estándar nueva: primero acá, después
en el `env.example` del skill dueño.

| Variable | Dueño | Consumidores | Ambientes | Notas |
|---|---|---|---|---|
| `SERVICE_NAME` | agentic-logging | observability, qa | todos | sufijo por ambiente (`-dev`, `-staging`) |
| `APP_SOURCE_DIRS` | agentic-logging | — | todos | honeypot: dirs de código propio; monorepo incluye `packages` |
| `LOG_LEVEL` | agentic-logging | — | todos | `debug` local, `warn` en prod |
| `LOG_PROVIDER` | agentic-logging | observability | todos | `local` SOLO en `next dev`; nunca `local` en Vercel |
| `LOG_PROVIDER_API_URL` | agentic-logging | agent-gps | vercel | endpoint de consulta del backend de logs |
| `LOG_PROVIDER_TOKEN` | agentic-logging | agent-gps | vercel | credencial de consulta |
| `LOG_REDACT_KEYS` | agentic-logging | — | todos | extiende el scrub de PII |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | alyp-observability | — | staging/prod | vacío = no-op |
| `OTEL_EXPORTER_OTLP_HEADERS` | alyp-observability | — | staging/prod | auth del backend OTLP |
| `LOKI_PUSH_URL` / `LOKI_AUTH` | alyp-observability | — | vercel | solo perfil Grafana/Loki; ver gotchas en el skill |
| `NEXT_PUBLIC_SUPABASE_URL` / `*_ANON_KEY` | alyp-new-project (F4) | app | todos | por ambiente; anon key va en allowlist de secret-scan |
| `SUPABASE_SERVICE_ROLE_KEY` | alyp-new-project (F4) | app (solo Node runtime) | todos | NUNCA en Edge middleware ni en cliente |
| `DATABASE_URL` / `DIRECT_URL` | alyp-new-project (F4) | migraciones | todos | pooler 6543 / directo 5432 |
| `QA_*` (credenciales de personas) | alyp-qa-standard | e2e, smoke | dev/staging | solo por env vars, nunca en repo |
| `CONTEXT_BOT_TOKEN` | alyp-new-project (F8) | update-context CI | GitHub | secret de Actions |

Regla de oro heredada del logging: la app solo lee env — cambiar de backend
(logs, OTel) = cambiar valores, cero cambios de código.
```

- [ ] **Step 2: Referenciar el contrato desde los 2 skills que más listan env vars**

En `skills/alyp-observability/SKILL.md`, al inicio de la FASE 5, agregar la línea:

```markdown
> Tabla única de variables y dueños: `contracts/env-vars.md` del repo de estándares.
```

En `skills/agentic-logging/SKILL.md`, en la sección `## Per-project variables`, agregar:

```markdown
Canonical table (owners + consumers): `contracts/env-vars.md` in the standards repo.
```

- [ ] **Step 3: Verificar y commitear**

```bash
node scripts/lint-skills.mjs   # Expected: OK
git add contracts/env-vars.md skills/alyp-observability/SKILL.md skills/agentic-logging/SKILL.md
git commit -m "docs: contrato único de env vars con dueño por skill"
```

---

## FASE C — Contratos agnósticos (split contrato/perfil)

### Task 8: `contracts/code-standard.md` + referencia desde agentic-standards

**Files:**
- Create: `contracts/code-standard.md`
- Modify: `skills/alyp-agentic-standards/SKILL.md` (declararse perfil del contrato)

**Interfaces:**
- Produces: contrato v1 con invariantes sin vendors. El SKILL.md pasa a ser explícitamente "perfil next·supabase·vercel del contrato".

- [ ] **Step 1: Escribir `contracts/code-standard.md`**

```markdown
# Contrato: code-standard (v1) — sello `agentic-standard: v1`

Invariantes del código "agentic-ready", agnósticos de stack. El "cómo" vive en un
perfil (hoy: `skills/alyp-agentic-standards/` = perfil next·supabase·vercel).
Prueba de fuego: si una regla nombra un producto, pertenece al perfil, no acá.

## Invariantes (I1–I9)

- **I1 — Ciclo del agente.** Todo optimiza LEER → ENTENDER → CAMBIAR → VERIFICAR:
  lo que abarata un paso del ciclo sube la tasa de éxito y baja el costo.
- **I2 — Gate único determinista.** Existe UN comando de verificación (typecheck +
  lint + tests) que el agente corre tras cada cambio, espejado exactamente en CI.
- **I3 — Done = gate + evidencia.** Una tarea está terminada solo con el gate verde
  Y evidencia reproducible del happy path (test que cubre la lógica, o evidencia de
  runtime real). "Parece correcto" = no-evaluable, nunca positivo.
- **I4 — Co-localización por dominio.** El código se agrupa por dominio de negocio
  con naming uniforme y predecible (`<dominio>.<rol>.<ext>`), no por capa técnica.
- **I5 — Contratos de datos con derivación.** Los tipos SE DERIVAN de un schema
  validable en runtime (única fuente de verdad); toda entrada externa se valida
  con parse seguro y código de error UPPER_SNAKE.
- **I6 — Fronteras de módulo.** Cada dominio expone una API pública explícita
  (barrel); los imports profundos entre dominios están prohibidos y el linter lo
  hace cumplir.
- **I7 — Archivos chicos.** < 200 líneas por archivo; si crece, se divide por
  responsabilidad.
- **I8 — Errores estructurados.** Ningún catch vacío; todo error se registra vía el
  logging-standard (ver `contracts/logging-standard.md`). Sin logging no estructurado.
- **I9 — Generación sobre repetición.** Crear un dominio nuevo es UN comando que
  scaffoldea la estructura completa (archivos + stub de migración + runbook).

## Aceptación agnóstica (para cualquier perfil)

1. El gate único existe, pasa limpio y CI ejecuta exactamente el mismo comando.
2. El generador crea un dominio completo en un comando.
3. Un import profundo entre dominios falla el lint; el import por barrel pasa.
4. El repo lleva el sello `agentic-standard: v1` en su doc de agente y el
   manifiesto `standards.yaml` lo declara.

## Perfiles

| Perfil | Implementación |
|---|---|
| next·supabase·vercel | `skills/alyp-agentic-standards/` (pnpm verify, Zod, ESLint no-restricted-imports, new-feature.mjs, Vitest, RLS) |
```

- [ ] **Step 2: Declarar el perfil en el SKILL.md**

En `skills/alyp-agentic-standards/SKILL.md`, después de la línea `**Versión del estándar**: agentic-standard: v1`, agregar:

```markdown
**Contrato**: este skill es el perfil **next·supabase·vercel** del contrato
`contracts/code-standard.md` (invariantes I1–I9). Ante conflicto, el contrato manda.
```

- [ ] **Step 3: Verificar y commitear**

```bash
node scripts/lint-skills.mjs
git add contracts/code-standard.md skills/alyp-agentic-standards/SKILL.md
git commit -m "feat: contrato code-standard v1 separado del perfil next-supabase-vercel"
```

### Task 9: `contracts/qa-standard.md` + sobre único de evidencia

**Files:**
- Create: `contracts/qa-standard.md`
- Create: `contracts/evidencia.schema.json`
- Modify: `skills/alyp-qa-standard/SKILL.md` (referencia al contrato)

**Interfaces:**
- Consumes: `skills/alyp-qa-standard/templates/veredicto.schema.json` (leerlo primero: el sobre debe ser superset compatible — el `veredicto.json` de QA es una instancia del sobre con `tipo: e2e`).
- Produces: `evidencia.schema.json` — el envelope que el `revisor`/juez de la orquestación consume venga de donde venga la evidencia.

- [ ] **Step 1: Escribir `contracts/qa-standard.md`**

```markdown
# Contrato: qa-standard (v1) — sello `qa-standard: v1`

Pruebas automatizadas de flujos de negocio, agnósticas de stack. El "cómo"
(Playwright, seeds SQL, pgTAP) vive en el perfil `skills/alyp-qa-standard/`.

## Principios (P1–P6)

- **P1 — Catálogo declarativo único.** Los flujos de negocio se describen UNA vez,
  en lenguaje de negocio (nunca selectores/detalles de UI), en un catálogo
  declarativo. El runner determinista lo implementa; los agentes lo interpretan.
- **P2 — Estado conocido.** Toda corrida parte de reset + seed idempotentes
  (correr 2 veces = mismo estado). Jamás se trunca identidad/autenticación.
- **P3 — Tres oráculos.** Un flujo pasa solo si pasan UI + persistencia + logs
  (cero errores para el trace de la corrida — consume el traceid-contract del
  logging-standard). Assert solo de UI = el test miente.
- **P4 — Veredicto por corrida.** Toda corrida deja un veredicto estructurado
  (instancia de `contracts/evidencia.schema.json`) + artefactos.
- **P5 — Determinista para regresión, agéntico para interpretación.** El agente
  ejecuta el catálogo (no improvisa cobertura) y nunca reemplaza al runner en CI.
- **P6 — PROD es solo-lectura.** Los flujos declaran ambientes permitidos; el
  ambiente productivo jamás recibe escrituras de QA.

## Criticidades

P0 = CI en cada PR + smoke post-deploy · P1 = CI en cada PR · P2 = nocturno +
exploratorio agéntico. Presupuestos (minutos CI / tokens) declarados en el config.

## Perfiles

| Perfil | Implementación |
|---|---|
| next·supabase·vercel | `skills/alyp-qa-standard/` (YAML + Playwright + oráculo DB Supabase + smoke.md) |
```

- [ ] **Step 2: Escribir `contracts/evidencia.schema.json`**

Antes de escribir, leer `skills/alyp-qa-standard/templates/veredicto.schema.json` y conservar sus nombres de campos donde coincidan (compatibilidad: un `veredicto.json` válido debe seguir siéndolo). Envelope objetivo:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://github.com/alyp-studio/coding_practices_alyp/contracts/evidencia.schema.json",
  "title": "Sobre único de evidencia — contrato v1",
  "description": "Toda evidencia reproducible (test, comando, browser, corrida e2e) se reporta en este envelope. Es lo que el revisor/juez consume para dar veredicto.",
  "type": "object",
  "required": ["tipo", "veredicto", "comando", "timestamp"],
  "properties": {
    "tipo": { "enum": ["test", "comando", "browser", "e2e"] },
    "veredicto": { "enum": ["pass", "fail", "no-evaluable"] },
    "comando": { "type": "string", "description": "comando exacto que reproduce la evidencia" },
    "resultado": { "type": "string", "description": "salida relevante (recortada), no el dump completo" },
    "artefactos": { "type": "array", "items": { "type": "string" }, "description": "rutas a screenshots/traces/reportes" },
    "traceId": { "type": "string", "description": "trace de la corrida cuando aplica (oráculo de logs)" },
    "ambiente": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "detalle": { "type": "object", "description": "extensión por tipo — p. ej. el veredicto.json completo de una corrida e2e" }
  }
}
```

Si `veredicto.schema.json` usa otros nombres para `veredicto`/`artefactos`, adaptar el envelope a los nombres YA desplegados (NOMI los usa) — el contrato documenta lo existente, no lo rompe.

- [ ] **Step 3: Referenciar el contrato en el SKILL.md de qa**

En `skills/alyp-qa-standard/SKILL.md`, tras el título, agregar:

```markdown
**Contrato**: perfil next·supabase·vercel de `contracts/qa-standard.md` (P1–P6).
El `veredicto.json` es una instancia del sobre `contracts/evidencia.schema.json`.
```

- [ ] **Step 4: Validar el schema y commitear**

```bash
node -e "JSON.parse(require('fs').readFileSync('contracts/evidencia.schema.json','utf8')); console.log('JSON válido')"
node scripts/lint-skills.mjs
git add contracts/ skills/alyp-qa-standard/SKILL.md
git commit -m "feat: contrato qa-standard v1 + sobre único de evidencia"
```

### Task 10: `contracts/logging-standard.md` (schema v1 congelado, claves en español)

**Files:**
- Create: `contracts/logging-standard.md`
- Modify: `skills/agentic-logging/SKILL.md` (referencia al contrato)

**Interfaces:**
- Consumes: el "Log schema (error contract)" ya documentado en `skills/agentic-logging/SKILL.md`.
- Produces: contrato con las claves **congeladas** — el oráculo de logs de QA y `agent-gps` dependen de ellas.

- [ ] **Step 1: Escribir `contracts/logging-standard.md`**

```markdown
# Contrato: logging-standard (v1) — sello `logging-standard: v1`

## Las 3 reglas de oro (agnósticas)

1. **Nada de errores en texto plano** — todo error es JSON estructurado con
   `traceId`, `contexto` y objeto `error`.
2. **Honeypot** — la ubicación registrada es la primera línea de TU código,
   nunca de dependencias/framework.
3. **Salida agnóstica** — la app solo escribe a stdout/stderr; la persistencia
   es de la plataforma (drain/collector), configurada por env vars.

## Schema v1 (claves CONGELADAS)

Las claves del JSON están en **español por decisión de estándar Alyp** y son un
contrato consumido por el extractor (`agent-gps`) y por el oráculo de logs del
qa-standard. Cambiar una clave = versión mayor del contrato con período de alias.

Claves de primer nivel: `nivel`, `servicio`, `env`, `release`, `timestamp`,
`traceId`, `contexto`, `metadata`, `error`.
Claves de `error`: `mensaje`, `codigo` (UPPER_SNAKE), `ubicacion_exacta`,
`archivo`, `linea`, `columna`, `funcion`, `stack_snippet`.

## traceid-contract (lo que otros estándares consumen)

- Todo error de una corrida/request comparte un `traceId` consultable.
- Dado un `traceId`, el extractor devuelve `archivo` + `linea` + `motivo`
  (navegación directa: un archivo, una línea, un fix).
- El oráculo de logs de QA: "cero entradas `nivel: error` para el `traceId`
  de la corrida" es verificable mecánicamente.

## Aceptación agnóstica

1. Un error lanzado produce UNA línea JSON en stderr con `traceId` y ubicación
   apuntando a código propio.
2. El extractor navega de `traceId` a ubicación sin acceso al código fuente.
3. El linter del proyecto falla ante logging no estructurado y catch vacío.

## Perfiles

| Perfil | Implementación |
|---|---|
| Node/TS (cualquier framework) | `skills/agentic-logging/` (assets verbatim, cero deps) |
```

- [ ] **Step 2: Referenciar desde el SKILL.md**

En `skills/agentic-logging/SKILL.md`, en la sección `## Log schema (error contract)`, agregar al inicio:

```markdown
This schema is frozen as contract v1 — see `contracts/logging-standard.md`
(Spanish keys are an Alyp standard decision; changing any key is a major version).
```

- [ ] **Step 3: Verificar y commitear**

```bash
node scripts/lint-skills.mjs
git add contracts/logging-standard.md skills/agentic-logging/SKILL.md
git commit -m "feat: contrato logging-standard v1 con schema congelado"
```

---

## FASE D — Orquestación agnóstica

### Task 11: Tiers abstractos + `capacity.yaml` (devstral-orchestration v2.6)

**Files:**
- Create: `skills/devstral-orchestration/versions/v2.5/SKILL.md` (snapshot verbatim del actual)
- Create: `skills/devstral-orchestration/capacity.example.yaml`
- Create: `contracts/orchestration.md`
- Modify: `skills/devstral-orchestration/SKILL.md` (v2.6: tiers + referencia a capacity)
- Create: `~/.claude/capacity.yaml` (instancia local, NO va al repo)

**Interfaces:**
- Produces: convención `~/.claude/capacity.yaml` (mapeo tier→modelo + límites del entorno). El SKILL.md v2.6 la lee; sin el archivo, usa el example y avisa una vez.

- [ ] **Step 1: Snapshot de v2.5**

```bash
mkdir -p skills/devstral-orchestration/versions/v2.5
cp skills/devstral-orchestration/SKILL.md skills/devstral-orchestration/versions/v2.5/SKILL.md
```

- [ ] **Step 2: Escribir `capacity.example.yaml`**

```yaml
# capacity.yaml — perfil de capacidad del ENTORNO (máquina/equipo), no doctrina.
# Instalar como ~/.claude/capacity.yaml y ajustar. El protocolo (SKILL.md) habla
# de tiers; este archivo dice qué modelo y qué límites tiene CADA tier en TU entorno.
version: 1
tiers:
  juez: claude-fable-5             # veredicto final, consultor
  razonador: claude-opus-4-8       # seguridad crítica, arquitectura, juez adversarial
  obrero: claude-sonnet-5          # implementación, research, review normal
  barato: claude-haiku-4-5         # búsquedas amplias, triage de logs
  mecanico_light: qwen2.5-coder:3b # local default (null si no hay ejecutor local)
  mecanico_heavy: qwen3-coder:30b  # local con razonamiento (null si no aplica)
local:
  disponible: true                 # false → todo lo mecánico va a `barato` (cloud)
  max_delegaciones_vivas: 2        # = OLLAMA_NUM_PARALLEL; gobernador anti-estampida
  qa_hooks: true                   # hooks qa-review/supervise instalados
cloud:
  max_subagentes_por_ola: 10       # cap del harness en este entorno
  max_razonador_por_ola: 3         # dosificación del tier caro/lento
notas: >
  Valores medidos del entorno (RAM, tiempos, co-residencia de modelos) van acá,
  no en el protocolo. Referencia local: ~/local-llm-stack/ARCHITECTURE.md.
```

- [ ] **Step 3: Escribir `contracts/orchestration.md`**

```markdown
# Contrato: orquestación multi-modelo (v1)

Protocolo agnóstico de modelos concretos. Los 6 roles son TIERS; el mapeo
tier→modelo y los límites del entorno viven en `capacity.yaml` (por máquina).

## Tiers

| Tier | Rol | Nunca hace |
|---|---|---|
| **juez** | veredicto final: seguridad crítica, merge/prod, irreversibles; síntesis; routing | delegarse el veredicto |
| **razonador** | análisis pesado con spec cerrada: seguridad (borrador), arquitectura, debugging endiablado, juez adversarial | exploración abierta (cara y lenta) |
| **obrero** | implementación, research, debugging normal, review no-crítico | veredictos de seguridad |
| **barato** | búsquedas amplias, triage, resúmenes | decisiones |
| **mecánico** | tareas verificables e inequívocas (tests, codemods, scaffolding) | nada ambiguo |
| **qa-automático** | veredicto tras cada edición/delegación | bloquear sin criterio (falsos positivos se evalúan) |

## Invariantes (independientes del entorno)

1. El contexto del orquestador es el recurso más caro: leé poco, delegá mucho,
   recibí resúmenes.
2. Al mecánico solo lo verificable + inequívoco. Seguridad nunca baja del razonador
   y el veredicto nunca baja del juez/orquestador.
3. Si dudás del tier, subí uno.
4. Nunca aceptar trabajo delegado sin resumen/veredicto con evidencia
   (`contracts/evidencia.schema.json`).
5. Gobernador anti-estampida: nunca más delegaciones locales vivas que
   `local.max_delegaciones_vivas`.
6. Descomposición estándar ralph: subtareas desatendidas, juzgables, con evidencia
   de cierre y tier declarado por bloque.

## Degradación

- Sin ejecutor local (`local.disponible: false`): lo mecánico va al tier barato.
- Sin hooks de QA local: el veredicto lo pide quien delega (no es error del trabajo).
- Orquestador de tier obrero: consulta obligatoria al tier juez en seguridad
  crítica, irreversibles y arquitectura.
```

- [ ] **Step 4: Editar el SKILL.md a v2.6 (tiers + capacity)**

Ediciones exactas sobre `skills/devstral-orchestration/SKILL.md`:

1. Frontmatter: `version: 2.5.0` → `version: 2.6.0`; en `description:` reemplazar "v2.5" por "v2.6" y agregar al final: "Mapeo tier→modelo y límites del entorno en ~/.claude/capacity.yaml (contrato: contracts/orchestration.md)."
2. Título: `# Orquestación multi-modelo v2.5 — Alyp Studio (dual Fable/Opus)` → `# Orquestación multi-modelo v2.6 — Alyp Studio (tiers + capacity)`.
3. Insertar tras el título:

```markdown
> **Capacity**: los nombres de modelos de este documento son el mapeo ACTUAL de
> `~/.claude/capacity.yaml` (si no existe: copiá `capacity.example.yaml` de este
> skill y avisá una vez). Doctrina = tiers (juez/razonador/obrero/barato/mecánico);
> ver `contracts/orchestration.md`. Cambia un modelo → se edita capacity.yaml,
> no este protocolo.
```

4. En la tabla "Los 6 roles", encabezar cada fila con el tier: `**Orquestador**` → `**Orquestador (tier juez)**`, `**Consultor**` → `**Consultor (tier juez)**`, `**Razonador**` (queda), `**Obrero**` (queda), `**Mecánico**` (queda), `**QA**` → `**QA (qa-automático)**`.
5. En la sección "Reglas generales", REEMPLAZAR el bullet completo de RAM medida ("RAM (36 GB, **medido**): … con nada más.") por:

```markdown
- Límites del entorno (RAM, tiers locales, delegaciones concurrentes, tamaño de ola):
  en `~/.claude/capacity.yaml`. Los valores medidos de ESTA máquina están en
  `~/local-llm-stack/ARCHITECTURE.md`. Regla portable: default al tier light local;
  heavy solo con razonamiento mecánico, asumiendo que no co-reside cómodo.
```

6. En "Config de paralelismo (Ollama)": conservar la tabla pero agregar debajo: `Estos valores son la instancia local de capacity.yaml (local.max_delegaciones_vivas = OLLAMA_NUM_PARALLEL).`

- [ ] **Step 5: Crear la instancia local (fuera del repo)**

```bash
cp skills/devstral-orchestration/capacity.example.yaml ~/.claude/capacity.yaml
```

(En modo `--link`, el repo ya es lo que Claude Code lee — no hay que reinstalar.)

- [ ] **Step 6: Verificar y commitear**

```bash
node scripts/lint-skills.mjs
grep -c "v2.6" skills/devstral-orchestration/SKILL.md          # Expected: >= 2
grep -c "capacity.yaml" skills/devstral-orchestration/SKILL.md # Expected: >= 2
test -f ~/.claude/capacity.yaml && echo "capacity local OK"
git add skills/devstral-orchestration/ contracts/orchestration.md
git commit -m "feat(orquestacion): v2.6 — tiers abstractos + capacity.yaml por entorno"
```

---

## FASE E — Instalador para cualquier equipo

### Task 12: Empaquetado como plugin de Claude Code

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: `skills/` y `agents/` en la raíz (layout estándar de plugin).
- Produces: instalable vía `/plugin marketplace add alyp-studio/coding_practices_alyp` + `/plugin install alyp-dev-standards@alyp-studio`.

- [ ] **Step 1: Verificar el schema vigente de plugins**

Despachar el agente `claude-code-guide` con la pregunta: "Formato vigente de `.claude-plugin/plugin.json` y `marketplace.json` para un plugin que empaqueta skills/ y agents/ desde la raíz del repo; ¿campos requeridos y comando de validación?". Ajustar los JSON del paso 2 si el schema difiere.

- [ ] **Step 2: Escribir `.claude-plugin/plugin.json`**

```json
{
  "name": "alyp-dev-standards",
  "version": "2.0.0",
  "description": "Ecosistema de desarrollo Alyp Studio: creación de proyectos SaaS, estándar de código agentic-ready, logging GPS, observabilidad, QA de flujos de negocio, orquestación multi-modelo y curaduría de conocimiento. Contratos agnósticos + perfil next·supabase·vercel.",
  "author": { "name": "Alyp Studio", "email": "pr@pablorodriguezb.com" },
  "homepage": "https://github.com/alyp-studio/coding_practices_alyp",
  "keywords": ["saas", "agentic", "standards", "qa", "logging", "orchestration"]
}
```

- [ ] **Step 3: Escribir `.claude-plugin/marketplace.json`**

```json
{
  "name": "alyp-studio",
  "owner": { "name": "Alyp Studio", "email": "pr@pablorodriguezb.com" },
  "plugins": [
    {
      "name": "alyp-dev-standards",
      "source": "./",
      "description": "Skills + agentes del ecosistema de desarrollo Alyp (contratos agnósticos, perfil next·supabase·vercel)."
    }
  ]
}
```

- [ ] **Step 4: Validar e instalar de prueba**

```bash
claude plugin validate . 2>/dev/null || echo "validate no disponible en esta versión — validación manual"
```

Prueba real (sesión interactiva de claude): `/plugin marketplace add /Users/parb/Dev/alyp-studio/coding_practices_alyp` → `/plugin install alyp-dev-standards@alyp-studio` → confirmar que los skills aparecen namespaced (`alyp-dev-standards:alyp-qa-standard`). Después desinstalar el plugin de prueba en nuestra máquina (nosotros usamos `--link`, no el plugin — evitar skills duplicados).

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/
git commit -m "feat: empaquetado como plugin de Claude Code (marketplace alyp-studio)"
```

### Task 13: Documentación de adopción (README + installation + guía de equipos)

**Files:**
- Modify: `README.md` (re-escritura a 3 capas)
- Modify: `docs/installation.md` (re-escritura completa — el actual instala a `~/.claude/commands/`, obsoleto)
- Create: `docs/adopcion-equipos.md`
- Modify: `docs/skill-ecosystem.md` (actualizar de 4 a 7 skills; puede reusar el análisis de los diagramas de la memoria `skills-desarrollo-alyp.md`)

**Interfaces:**
- Consumes: todo lo anterior (instalador, plugin, contratos, manifiesto).

- [ ] **Step 1: Re-escribir `docs/installation.md`**

Contenido requerido (secciones): **Vía 1 — Plugin (recomendada para equipos)**: `/plugin marketplace add alyp-studio/coding_practices_alyp` + `/plugin install alyp-dev-standards@alyp-studio`. **Vía 2 — Script**: `git clone` + `./scripts/install.sh` (`--copy` default; `--link` para quien desarrolla el ecosistema; `--target` para otro dir). **Vía 3 — Manual**: copiar `skills/<nombre>/` completos (nunca solo el SKILL.md — los assets son parte del skill) a `~/.claude/skills/`. **Post-instalación**: crear `~/.claude/capacity.yaml` desde el example; qué es opcional (ejecutor local Ollama, hooks de QA — el protocolo degrada sin ellos). **Actualización**: `git pull` + re-correr install (o nada, en modo link) + `scripts/check-drift.sh`. Eliminar todas las referencias a `~/.claude/commands/`.

- [ ] **Step 2: Escribir `docs/adopcion-equipos.md`**

Contenido requerido: (1) qué adopta un equipo — los CONTRATOS (`contracts/`), siendo los skills el perfil next·supabase·vercel; si tu stack difiere, implementás otro perfil cumpliendo la aceptación agnóstica de cada contrato; (2) orden de adopción en un repo existente: logging → code-standard (modo audit) → observability → qa (mismo orden que `requires:`); (3) el manifiesto `standards.yaml` y las excepciones declaradas; (4) decisiones de marca que se heredan y por qué: dominio/logs/códigos en español (contrato congelado), naming `alyp-*`; (5) qué es opcional: orquestación local (capacity con `local.disponible: false`), maestro; (6) soporte: issues en este repo.

- [ ] **Step 3: Re-escribir `README.md`**

Estructura requerida: qué es (1 párrafo), diagrama de 3 capas en texto (contratos → skills/perfil → repo cliente con manifiesto), tabla de los 7 skills (nombre, rol, contrato que implementa, version), instalación (link a `docs/installation.md`), desarrollo del ecosistema (modo `--link`, `lint-skills`, canario, cómo versionar: editar skill → bump `version:` → CHANGELOG → PR a develop), estructura de dirs real.

- [ ] **Step 4: Actualizar `docs/skill-ecosystem.md`**

Reemplazar el contenido de 4 skills por el mapa de 7 con la cadena de delegación (new-project → standards/observability/infra → logging → qa como consumidor del traceId; orquestación transversal; maestro cerrando el ciclo) y el ciclo operativo (planificar → implementar → verificar → probar → observar → curar).

- [ ] **Step 5: Verificar y commitear**

```bash
grep -c "commands/" docs/installation.md    # Expected: 0
grep -c "alyp-qa-standard" README.md         # Expected: >= 1
git add README.md docs/
git commit -m "docs: instalación (plugin/script/manual), guía de adopción y ecosistema de 7 skills"
```

---

## FASE F — Meta-QA canario + ciclo de mejora

### Task 14: Canario funcional en CI

**Files:**
- Create: `canary/fixture/package.json`
- Create: `canary/fixture/tsconfig.json`
- Create: `canary/fixture/src/quiebra.ts`
- Create: `scripts/canary.sh`
- Create: `.github/workflows/canary.yml`

**Interfaces:**
- Consumes: `scripts/lint-skills.mjs` (Task 4), assets de `skills/agentic-logging/` y ESLint config de `skills/alyp-agentic-standards/`.
- Produces: `scripts/canary.sh` — exit 0/1; corre en CI ante cambios en `skills/`, `contracts/` o `scripts/`.

- [ ] **Step 1: Crear la fixture mínima**

`canary/fixture/package.json`:

```json
{
  "name": "canary-fixture",
  "private": true,
  "type": "module"
}
```

`canary/fixture/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["utils/**/*.ts", "src/**/*.ts"]
}
```

`canary/fixture/src/quiebra.ts` (dispara las reglas ESLint del estándar — el canario espera que el lint FALLE aquí):

```typescript
export function quiebra(): void {
  console.log('console desnudo — el lint agentic debe marcarme');
  try {
    JSON.parse('{roto');
  } catch {}
}
```

- [ ] **Step 2: Escribir `scripts/canary.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
# Canario del ecosistema: valida que los skills sigan instalables y funcionales.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
echo "== 1/3 lint estructural =="
node "$REPO_DIR/scripts/lint-skills.mjs"

echo "== 2/3 assets de logging compilan (instalación bootstrap simulada) =="
cp -R "$REPO_DIR/canary/fixture" "$WORK/proj"
mkdir -p "$WORK/proj/utils"
cp "$REPO_DIR/skills/agentic-logging/assets/logger.ts"      "$WORK/proj/utils/logger.ts"
cp "$REPO_DIR/skills/agentic-logging/assets/error-codes.ts" "$WORK/proj/utils/error-codes.ts"
( cd "$WORK/proj" && npx --yes -p typescript@latest tsc -p tsconfig.json )
echo "✓ logger.ts + error-codes.ts compilan bajo strict"

echo "== 3/3 la config ESLint agentic detecta console desnudo y catch vacío =="
( cd "$WORK/proj" \
  && cp "$REPO_DIR/skills/agentic-logging/assets/.eslintrc.agentic.cjs" .eslintrc.cjs \
  && npx --yes -p eslint@8 -p @typescript-eslint/parser eslint --no-eslintrc -c .eslintrc.cjs src/quiebra.ts \
  && { echo "✗ el lint DEBIÓ fallar sobre quiebra.ts"; exit 1; } \
  || echo "✓ eslint agentic marca las violaciones esperadas" )

echo "CANARIO OK"
```

Nota: el paso 3 asume ESLint 8 + parser clásico como en el asset; si `.eslintrc.agentic.cjs` requiere otro invoke (revisarlo al implementar), ajustar el comando manteniendo el assert invertido (lint DEBE fallar sobre la fixture).

- [ ] **Step 3: Correr el canario local**

```bash
chmod +x scripts/canary.sh
./scripts/canary.sh   # Expected: "CANARIO OK", exit 0
```

Si el paso 2 falla compilando: es drift real de los assets (bug encontrado) — corregir el asset en `skills/agentic-logging/assets/` y anotar en CHANGELOG.

- [ ] **Step 4: Workflow CI**

`.github/workflows/canary.yml`:

```yaml
name: canario-ecosistema
on:
  pull_request:
    paths: ['skills/**', 'contracts/**', 'scripts/**', 'canary/**']
  push:
    branches: [develop, main]
    paths: ['skills/**', 'contracts/**', 'scripts/**', 'canary/**']
jobs:
  canary:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: ./scripts/canary.sh
```

- [ ] **Step 5: Commit**

```bash
git add canary/ scripts/canary.sh .github/workflows/canary.yml
git commit -m "feat: canario de meta-QA (lint estructural + assets compilan + eslint dispara) en CI"
```

### Task 15: Ciclo de promoción local→global + cierre (PR y tag)

**Files:**
- Modify: `skills/alyp-maestro/SKILL.md` (acción `promover`)
- Modify: `contracts/manifest.md` (no — ya cubierto; solo maestro)

**Interfaces:**
- Consumes: skills locales que `alyp-maestro` genera en repos cliente.
- Produces: camino formal de vuelta al estándar global (este repo).

- [ ] **Step 1: Agregar la acción `promover` al maestro**

En `skills/alyp-maestro/SKILL.md`, después de la sección `## Acción: curar`, insertar:

```markdown
## Acción: `promover` (local → global)

Disparador: al curar, detectás que una skill local (pitfall/metodología/decisión)
ya existe —en esencia— en **2 o más repos** de clientes distintos, o contradice
algo del estándar global. Procedimiento:

1. **Verificá la recurrencia con evidencia**: citá las skills locales equivalentes
   (repo + ruta) o las observaciones de engram que la respaldan. Una sola aparición
   no se promueve.
2. **Redactá la propuesta como cambio concreto** al repo de estándares
   (`alyp-studio/coding_practices_alyp`): a qué contrato o skill pertenece, el diff
   propuesto, y el bump de `version:` que corresponde.
3. **Abrí un PR a `develop`** de ese repo con la propuesta (o dejá el paquete listo
   y avisá, si no tenés el repo a mano). El veredicto de incorporarla es del
   orquestador/usuario, no tuyo.
4. La skill local NO se borra al promover: se le anota `promovida: <PR>` y se
   elimina recién cuando la versión nueva del estándar esté instalada en ese repo.
```

- [ ] **Step 2: Verificar y commitear**

```bash
node scripts/lint-skills.mjs
git add skills/alyp-maestro/SKILL.md
git commit -m "feat(maestro): acción promover — ciclo local→global del conocimiento"
```

- [ ] **Step 3: Verificación final de todo el plan**

```bash
./scripts/canary.sh                     # Expected: CANARIO OK
./scripts/check-drift.sh                # Expected: exit 0 (symlinks)
git log --oneline develop | head -15    # Expected: los ~13 commits del plan
```

- [ ] **Step 4: PR y tag**

```bash
git push origin develop
gh pr create --repo alyp-studio/coding_practices_alyp --base main --head develop \
  --title "Ecosistema v2.0.0: fuente de verdad + contratos agnósticos + instalador" \
  --body "Ver CHANGELOG v2.0.0 y docs/plans/2026-07-06-agnosticos-v2-instalador.md. Canario en verde.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Tras el merge a main (decisión del usuario): `git tag v2.0.0 && git push origin v2.0.0`.

---

## Fuera de alcance (YAGNI, decidido)

- **Claves del log schema en inglés**: descartado — el español es decisión de estándar (CLAUDE.md global); el contrato lo congela y lo documenta para adoptantes.
- **Renombrar skills / quitar prefijo alyp-**: descartado — rompería referencias (CLAUDE.md, memorias, repos cliente); la marca queda como identidad del perfil.
- **Segundo perfil de stack** (p. ej. Express/Fly): no se implementa; los contratos dejan la puerta (tabla "Perfiles") y la aceptación agnóstica lo hace posible.
- **Publicar en npm / registry externo**: el plugin + script cubren la distribución; revisar solo si un equipo externo lo pide.
- **Canario full-chain con recursos cloud** (crear proyecto real GitHub+Supabase+Vercel): demasiado costo/ruido para CI; queda como runbook manual (el checklist-final de alyp-new-project ya lo es).
