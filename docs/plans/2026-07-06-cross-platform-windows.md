# Cross-platform (macOS + Windows) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el ecosistema `coding_practices_alyp` se instale y use en Windows además de macOS/Linux, sin duplicar lógica: instalador y meta-QA portados a Node (una sola fuente de verdad), artefactos Python corregidos, prueba real en CI Windows, y el límite de "uso" (Git Bash) documentado.

**Architecture:** Node es la capa portable (ya es dependencia dura: new-project ≥22, lint/canary). Los 3 scripts bash (`install.sh`, `check-drift.sh`, `canary.sh`) se reescriben como `.mjs` cross-platform; los `.sh`/`.ps1` quedan como shims de 2 líneas que invocan Node (cero duplicación). Vía plugin (`/plugin`) sigue siendo la vía #1 cross-platform (nativa de Claude Code). El "uso" de skills con `cp/grep/pnpm` requiere Git for Windows en Windows (requisito del propio Claude Code) — se documenta, no se reescribe cada snippet.

**Tech Stack:** Node ≥ 20.11 (ESM, `node:fs`/`node:os`/`node:path`/`node:child_process`), Python 3 (solo para token-savings, opcional), GitHub Actions (matriz ubuntu+windows), bash/PowerShell shims.

## Global Constraints

- Repo: `/Users/parb/Dev/alyp-studio/coding_practices_alyp`, rama `develop` (HEAD `426b775`, 8 skills incl. `alyp-token-savings`). Nunca commitear a `main` directo.
- **Una sola fuente de verdad por herramienta**: la lógica vive en el `.mjs`; los `.sh`/`.ps1` son shims que sólo hacen `exec node …`. Prohibido duplicar lógica de instalación en dos lenguajes.
- Node scripts: ESM (`.mjs`), sólo módulos `node:*`, cero dependencias npm. Deben correr con `node <script>` pelado en macOS, Linux y Windows.
- Windows sin admin: enlazar directorios = **junction** (`symlinkSync(src, dest, 'junction')`); enlazar archivos = intentar symlink y caer a copia ante `EPERM` (Developer Mode no garantizado).
- Rutas dentro de comandos de `settings.json`: **forward slashes** (`path.replace(/\\/g,'/')`) y entre comillas — funcionan en Git Bash y PowerShell.
- El schema de logging y las claves en español siguen congelados (no tocar).
- El sello y las versiones: bump de ecosistema a **2.1.0** (feature cross-platform); token-savings 1.0.0 → **1.0.1** (fix `/tmp` + install docs).
- Commits en español, prefijo convencional, terminando con:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Cada tarea cierra con su verificación ejecutada y su commit.

## Estructura de archivos final

```
scripts/
├── install.mjs        # NUEVO — instalador canónico cross-platform
├── install.sh         # shim → node install.mjs (reemplaza el bash actual)
├── install.ps1        # NUEVO — shim PowerShell → node install.mjs
├── check-drift.mjs    # NUEVO — drift check cross-platform
├── check-drift.sh     # shim → node check-drift.mjs
├── check-drift.ps1    # NUEVO — shim
├── canary.mjs         # NUEVO — canario cross-platform
├── canary.sh          # shim → node canary.mjs
└── lint-skills.mjs    # SIN CAMBIOS (ya portable)
skills/alyp-token-savings/artifacts/hooks/context-guard.py  # fix /tmp
.github/workflows/canary.yml   # matriz ubuntu + windows
docs/ (installation.md, README.md, adopcion-equipos.md, token-savings SKILL.md)
CHANGELOG.md · contracts/standards.example.yaml · .claude-plugin/plugin.json
```

---

### Task 1: `install.mjs` — instalador canónico cross-platform (+ shims)

**Files:**
- Create: `scripts/install.mjs`
- Rewrite: `scripts/install.sh` (a shim)
- Create: `scripts/install.ps1`
- Test: manual, contra un `--target` temporal (ver pasos)

**Interfaces:**
- Produces: `node scripts/install.mjs [--copy|--link] [--target DIR]`. Instala 8 skills + 4 agentes + `capacity.yaml` + artefactos token-savings + merge `settings.json`. Reemplaza a `install.sh` (bash). Consumido por docs (Task 6) y CI (Task 5).

- [ ] **Step 1: Escribir `scripts/install.mjs` (verbatim)**

```javascript
#!/usr/bin/env node
// Instalador cross-platform del ecosistema de skills Alyp (macOS · Linux · Windows).
//   node scripts/install.mjs [--copy|--link] [--target DIR]
//   --copy  (default) copia skills/ y agents/ al target — equipos externos
//   --link  enlaza al repo (junction en dirs, symlink→copia fallback en archivos) — dev
import {
  cpSync, mkdirSync, rmSync, existsSync, symlinkSync, lstatSync,
  readdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = platform() === 'win32';

let mode = 'copy';
let target = join(homedir(), '.claude');
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--link') mode = 'link';
  else if (a === '--copy') mode = 'copy';
  else if (a === '--target') target = resolve(argv[++i] ?? '');
  else { console.error(`arg desconocido: ${a}`); process.exit(2); }
}

const SKILLS = [
  'alyp-new-project', 'alyp-agentic-standards', 'agentic-logging',
  'alyp-observability', 'alyp-qa-standard', 'devstral-orchestration',
  'alyp-maestro', 'alyp-token-savings',
];

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

function place(src, dest, kind) {
  if (existsSync(dest) || isLink(dest)) rmSync(dest, { recursive: true, force: true });
  if (mode === 'link') {
    try {
      symlinkSync(src, dest, kind === 'dir' ? (isWin ? 'junction' : 'dir') : 'file');
      return 'link';
    } catch {
      // Windows: symlink de archivo requiere Developer Mode → caemos a copia
    }
  }
  if (kind === 'dir') cpSync(src, dest, { recursive: true });
  else copyFileSync(src, dest);
  return mode === 'link' ? 'copy(fallback)' : 'copy';
}

mkdirSync(join(target, 'skills'), { recursive: true });
mkdirSync(join(target, 'agents'), { recursive: true });

for (const s of SKILLS) {
  const src = join(REPO_DIR, 'skills', s);
  if (!existsSync(src)) { console.error(`⚠ skill ausente en repo: ${s}`); continue; }
  console.log(`✓ skill ${s} (${place(src, join(target, 'skills', s), 'dir')})`);
}

for (const f of readdirSync(join(REPO_DIR, 'agents')).filter((f) => f.endsWith('.md'))) {
  console.log(`✓ agente ${f} (${place(join(REPO_DIR, 'agents', f), join(target, 'agents', f), 'file')})`);
}

const capEx = join(REPO_DIR, 'skills', 'devstral-orchestration', 'capacity.example.yaml');
const capDst = join(target, 'capacity.yaml');
if (existsSync(capEx) && !existsSync(capDst)) {
  copyFileSync(capEx, capDst);
  console.log('✓ capacity.yaml creado desde example — editalo con los modelos/límites de tu entorno');
}

const ats = join(REPO_DIR, 'skills', 'alyp-token-savings', 'artifacts');
if (existsSync(ats)) {
  mkdirSync(join(target, 'hooks'), { recursive: true });
  const artefactos = [
    [join(ats, 'statusline-context.py'), join(target, 'statusline-context.py')],
    [join(ats, 'hooks', 'context-guard.py'), join(target, 'hooks', 'context-guard.py')],
    [join(ats, 'RTK.md'), join(target, 'RTK.md')],
  ];
  for (const [src, dst] of artefactos) if (existsSync(src)) place(src, dst, 'file');
  if (!isWin) {
    for (const f of ['statusline-context.py', join('hooks', 'context-guard.py')]) {
      try { chmodSync(join(target, f), 0o755); } catch { /* noop */ }
    }
  }
  console.log(`✓ token-savings artefactos (${mode})`);

  const py = resolvePython();
  if (!py) {
    console.log('⚠ Python 3 no encontrado — statusline/hook de token-savings NO cableados. Instalá Python 3 y re-corré, o cableá settings.json a mano.');
  } else {
    mergeSettings(target, py);
  }
}

console.log(`Instalación completa (${mode}) en ${target}`);

function resolvePython() {
  for (const c of (isWin ? ['python', 'py', 'python3'] : ['python3', 'python'])) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch { /* siguiente */ }
  }
  return null;
}

function mergeSettings(target, py) {
  const p = join(target, 'settings.json');
  let d = {};
  if (existsSync(p)) {
    try { d = JSON.parse(readFileSync(p, 'utf8')); } catch { d = {}; }
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    copyFileSync(p, `${p}.bak.${ts}`);
  }
  const fwd = (s) => s.replace(/\\/g, '/');
  const sl = fwd(join(target, 'statusline-context.py'));
  const hk = fwd(join(target, 'hooks', 'context-guard.py'));
  d.statusLine = { type: 'command', command: `${py} "${sl}"` };
  d.hooks = d.hooks ?? {};
  d.hooks.UserPromptSubmit = d.hooks.UserPromptSubmit ?? [];
  const present = d.hooks.UserPromptSubmit.some(
    (b) => (b.hooks ?? []).some((h) => (h.command ?? '').includes('context-guard.py')),
  );
  if (!present) {
    d.hooks.UserPromptSubmit.push({ hooks: [{ type: 'command', command: `${py} "${hk}"`, timeout: 10 }] });
  }
  writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
  console.log(`✓ settings.json: statusLine + UserPromptSubmit mergeados (intérprete: ${py}; backup .bak.*)`);
}
```

- [ ] **Step 2: Reescribir `scripts/install.sh` como shim**

```bash
#!/usr/bin/env bash
# Shim Unix — la lógica vive en install.mjs (cross-platform). No dupliques lógica acá.
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.mjs" "$@"
```

- [ ] **Step 3: Crear `scripts/install.ps1` (shim Windows)**

```powershell
# Shim PowerShell — la lógica vive en install.mjs (cross-platform).
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "install.mjs") @args
```

- [ ] **Step 4: Test — copy mode en target temporal, idempotencia y preservación de settings**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
TMP=$(mktemp -d)
# settings.json preexistente con una key ajena que DEBE sobrevivir
mkdir -p "$TMP"; printf '{"foo":"bar"}\n' > "$TMP/settings.json"
node scripts/install.mjs --copy --target "$TMP"
ls "$TMP/skills" | wc -l            # Expected: 8
ls "$TMP/agents" | wc -l            # Expected: 4
test -f "$TMP/capacity.yaml" && echo "capacity OK"
node -e "const d=require('$TMP/settings.json'); if(d.foo!=='bar')process.exit(1); if(!d.statusLine)process.exit(1); console.log('settings merge OK: foo preservado + statusLine')"
node scripts/install.mjs --copy --target "$TMP"   # idempotente: no debe romper
node -e "const d=require('$TMP/settings.json'); const n=d.hooks.UserPromptSubmit.filter(b=>(b.hooks||[]).some(h=>(h.command||'').includes('context-guard'))).length; if(n!==1)process.exit(1); console.log('hook no duplicado tras 2da corrida')"
```
Expected: 8 skills, 4 agentes, capacity OK, ambos merges OK, hook único.

- [ ] **Step 5: Test — link mode crea junction (dir) en este macOS**

```bash
TMP2=$(mktemp -d)
node scripts/install.mjs --link --target "$TMP2"
node -e "const {lstatSync}=require('fs'); if(!lstatSync('$TMP2/skills/agentic-logging').isSymbolicLink())process.exit(1); console.log('link dir OK')"
rm -rf "$TMP" "$TMP2"
```
Expected: `link dir OK`.

- [ ] **Step 6: Reinstalar el repo en la máquina real en modo `--link` (mantener el dev setup vivo)**

```bash
node scripts/install.mjs --link
node -e "const {lstatSync}=require('fs'),{join}=require('path'),{homedir}=require('os'); console.log(lstatSync(join(homedir(),'.claude','skills','devstral-orchestration')).isSymbolicLink()?'dev link OK':'FALLA')"
```
Expected: `dev link OK` (los 8 skills siguen enlazados al repo; el settings.json real se respalda antes de mergear).

- [ ] **Step 7: Commit**

```bash
chmod +x scripts/install.sh
git add scripts/install.mjs scripts/install.sh scripts/install.ps1
git commit -m "feat(instalador): install.mjs cross-platform (Node) + shims sh/ps1; reemplaza el instalador bash

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `check-drift.mjs` cross-platform (+ shims)

**Files:**
- Create: `scripts/check-drift.mjs`
- Rewrite: `scripts/check-drift.sh` (shim)
- Create: `scripts/check-drift.ps1`

**Interfaces:**
- Consumes: la instalación que produce Task 1.
- Produces: `node scripts/check-drift.mjs [TARGET]` — exit 1 si un skill falta o difiere (ignora los instalados como symlink/junction). Reemplaza `check-drift.sh` (usaba `diff -rq`).

- [ ] **Step 1: Escribir `scripts/check-drift.mjs` (verbatim)**

```javascript
#!/usr/bin/env node
// Drift check cross-platform: compara skills/ del repo vs lo instalado en TARGET.
// Ignora los instalados como symlink/junction (no pueden driftear).
import { readdirSync, readFileSync, existsSync, lstatSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? join(homedir(), '.claude'));
const skillsDir = join(REPO_DIR, 'skills');
let rc = 0;

const walk = (root) => {
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
};

for (const s of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const repoSkill = join(skillsDir, s.name);
  const inst = join(target, 'skills', s.name);
  try { if (lstatSync(inst).isSymbolicLink()) continue; } catch { /* no existe */ }
  if (!existsSync(inst)) { console.log(`FALTA: ${s.name} no instalado`); rc = 1; continue; }
  const rels = walk(repoSkill).map((p) => p.slice(repoSkill.length + 1));
  let difiere = false;
  for (const rel of rels) {
    const a = join(repoSkill, rel);
    const b = join(inst, rel);
    if (!existsSync(b) || statSync(a).size !== statSync(b).size ||
        readFileSync(a).compare(readFileSync(b)) !== 0) { difiere = true; break; }
  }
  if (difiere) { console.log(`DRIFT: ${s.name} difiere entre repo e instalado`); rc = 1; }
}

process.exit(rc);
```

- [ ] **Step 2: `scripts/check-drift.sh` shim**

```bash
#!/usr/bin/env bash
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-drift.mjs" "$@"
```

- [ ] **Step 3: `scripts/check-drift.ps1` shim**

```powershell
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "check-drift.mjs") @args
```

- [ ] **Step 4: Test — sin drift en modo link, con drift al mutar una copia**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
node scripts/check-drift.mjs; echo "link rc=$?"           # Expected: rc=0
TMP=$(mktemp -d); node scripts/install.mjs --copy --target "$TMP" >/dev/null
node scripts/check-drift.mjs "$TMP"; echo "copy limpia rc=$?"   # Expected: rc=0
printf 'x' >> "$TMP/skills/agentic-logging/SKILL.md"
node scripts/check-drift.mjs "$TMP"; echo "copy drift rc=$?"    # Expected: DRIFT + rc=1
rm -rf "$TMP"
```

- [ ] **Step 5: Commit**

```bash
chmod +x scripts/check-drift.sh
git add scripts/check-drift.mjs scripts/check-drift.sh scripts/check-drift.ps1
git commit -m "feat(drift): check-drift.mjs cross-platform + shims; reemplaza el bash con diff -rq

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `canary.mjs` cross-platform (+ shim)

**Files:**
- Create: `scripts/canary.mjs`
- Rewrite: `scripts/canary.sh` (shim)

**Interfaces:**
- Consumes: `scripts/lint-skills.mjs`, assets de `skills/agentic-logging/`, `canary/fixture/`.
- Produces: `node scripts/canary.mjs` — exit 0 con "CANARIO OK"; 3 pasos (lint / assets compilan bajo tsc strict / eslint DEBE fallar sobre la fixture). Reemplaza `canary.sh`. Corre en CI (Task 5) en ubuntu + windows.

- [ ] **Step 1: Escribir `scripts/canary.mjs` (verbatim)**

```javascript
#!/usr/bin/env node
// Canario cross-platform del ecosistema. 3 pasos:
//   1) lint estructural (lint-skills.mjs)
//   2) los assets de logging compilan bajo tsc strict
//   3) la config ESLint agentic DEBE fallar sobre la fixture (console desnudo + catch vacío)
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const work = mkdtempSync(join(tmpdir(), 'alyp-canary-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

try {
  console.log('== 1/3 lint estructural ==');
  run('node', [join(REPO_DIR, 'scripts', 'lint-skills.mjs')], REPO_DIR);

  console.log('== 2/3 assets de logging compilan bajo tsc strict ==');
  const proj = join(work, 'proj');
  cpSync(join(REPO_DIR, 'canary', 'fixture'), proj, { recursive: true });
  mkdirSync(join(proj, 'utils'), { recursive: true });
  copyFileSync(join(REPO_DIR, 'skills', 'agentic-logging', 'assets', 'logger.ts'), join(proj, 'utils', 'logger.ts'));
  copyFileSync(join(REPO_DIR, 'skills', 'agentic-logging', 'assets', 'error-codes.ts'), join(proj, 'utils', 'error-codes.ts'));
  run(npm, ['install', '--no-save', '--silent', 'typescript@latest', '@types/node@latest'], proj);
  run(npx, ['tsc', '-p', 'tsconfig.json'], proj);
  console.log('✓ logger.ts + error-codes.ts compilan bajo strict');

  console.log('== 3/3 eslint agentic detecta console desnudo y catch vacío ==');
  run(npm, ['install', '--no-save', '--silent', 'eslint@8', '@typescript-eslint/parser@6'], proj);
  const assetRc = join(REPO_DIR, 'skills', 'agentic-logging', 'assets', '.eslintrc.agentic.cjs').replace(/\\/g, '/');
  writeFileSync(join(proj, '.eslintrc.cjs'),
    `const base = require(${JSON.stringify(assetRc)});\n` +
    `module.exports = { ...base, parser: '@typescript-eslint/parser', ` +
    `parserOptions: { ecmaVersion: 2022, sourceType: 'module' }, ` +
    `rules: { ...base.rules, 'no-console': 'error' } };\n`);
  let lintFallo = false;
  try {
    run(npx, ['eslint', '--no-eslintrc', '-c', '.eslintrc.cjs', 'src/quiebra.ts'], proj);
  } catch { lintFallo = true; }
  if (!lintFallo) { console.error('✗ el lint DEBIÓ fallar sobre quiebra.ts'); process.exit(1); }
  console.log('✓ eslint agentic marca las violaciones esperadas');

  console.log('CANARIO OK');
} finally {
  rmSync(work, { recursive: true, force: true });
}
```

- [ ] **Step 2: `scripts/canary.sh` shim**

```bash
#!/usr/bin/env bash
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/canary.mjs" "$@"
```

- [ ] **Step 3: Test local**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
node scripts/canary.mjs   # Expected: termina con "CANARIO OK", exit 0
```
Si el paso 2 falla compilando: es drift real de un asset (bug) — reportarlo, no silenciarlo.

- [ ] **Step 4: Commit**

```bash
chmod +x scripts/canary.sh
git add scripts/canary.mjs scripts/canary.sh
git commit -m "feat(canary): canary.mjs cross-platform (Node) + shim; corre en Windows y Unix

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Fix Python de token-savings (`/tmp`) + versión

**Files:**
- Modify: `skills/alyp-token-savings/artifacts/hooks/context-guard.py`
- Modify: `skills/alyp-token-savings/SKILL.md` (frontmatter version + bloque de auditoría)

**Interfaces:**
- Produces: hook y statusline que corren en Windows (Python instalado). Sin cambios de comportamiento en Unix.

- [ ] **Step 1: Reemplazar `/tmp` por tempdir portable en `context-guard.py`**

En `context-guard.py`, agregar `import tempfile` junto a los imports existentes, y reemplazar:

```python
    marker = os.path.join("/tmp", f"claude-ctxguard-{sid}")
```
por:
```python
    marker = os.path.join(tempfile.gettempdir(), f"claude-ctxguard-{sid}")
```

- [ ] **Step 2: Hacer tolerante el bloque de auditoría del SKILL.md**

En `skills/alyp-token-savings/SKILL.md`, en el bloque de "Cómo auditar", reemplazar el `python3 -c ...` por una línea que aclare el intérprete por OS. Cambiar el bloque bash de auditoría para que empiece con:

```bash
# Windows sin Git Bash usa `python`; macOS/Linux `python3`.
PY=$(command -v python3 || command -v python)
"$PY" -c "import json,os;d=json.load(open(os.path.expanduser('~/.claude/settings.json')));\
print('statusLine:', 'statusLine' in d);\
print('ctx-guard:', any('context-guard' in h.get('command','') \
for b in d.get('hooks',{}).get('UserPromptSubmit',[]) for h in b.get('hooks',[])))"
```

(Reemplaza el `$HOME`/`open('$HOME/...')` por `os.path.expanduser` — portable dentro de Python.)

- [ ] **Step 3: Actualizar la sección "Cómo instalar" del SKILL.md**

Reemplazar el bloque de instalación que muestra `./scripts/install.sh` por el comando universal, dejando los shims como conveniencia:

```bash
git clone https://github.com/alyp-studio/coding_practices_alyp.git
cd coding_practices_alyp
node scripts/install.mjs            # universal (macOS · Linux · Windows)
# convenience: ./scripts/install.sh (Unix) · .\scripts\install.ps1 (Windows)
node scripts/install.mjs --link     # symlinks/junctions al repo (dev, cero drift)
```

Y agregar una nota: "En Windows, statusline/hook requieren **Python 3** en el PATH (`python` o `python3`); el instalador lo detecta y, si falta, saltea el cableado con aviso."

- [ ] **Step 4: Bump de versión**

En el frontmatter de `skills/alyp-token-savings/SKILL.md`: `version: 1.0.0` → `version: 1.0.1`.

- [ ] **Step 5: Verificar y commitear**

```bash
node scripts/lint-skills.mjs   # Expected: 8 skills OK
python3 -c "import ast; ast.parse(open('skills/alyp-token-savings/artifacts/hooks/context-guard.py').read()); print('py sintaxis OK')"
grep -c "/tmp" skills/alyp-token-savings/artifacts/hooks/context-guard.py   # Expected: 0
git add skills/alyp-token-savings/
git commit -m "fix(token-savings): tempdir portable (no /tmp) + intérprete tolerante + install.mjs; v1.0.1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: CI — matriz ubuntu + windows

**Files:**
- Modify: `.github/workflows/canary.yml`

**Interfaces:**
- Consumes: `scripts/canary.mjs`, `scripts/install.mjs`, `scripts/check-drift.mjs`.
- Produces: prueba real de portabilidad — el canario corre en `ubuntu-latest` y `windows-latest`; en Windows además un smoke de instalación (`install.mjs --copy` a un target temporal + drift check).

- [ ] **Step 1: Reescribir `.github/workflows/canary.yml`**

```yaml
name: canario-ecosistema
on:
  pull_request:
    paths: ['skills/**', 'contracts/**', 'scripts/**', 'canary/**', '.github/workflows/canary.yml']
  push:
    branches: [develop, main]
    paths: ['skills/**', 'contracts/**', 'scripts/**', 'canary/**', '.github/workflows/canary.yml']
jobs:
  canary:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: canario
        run: node scripts/canary.mjs
      - name: smoke de instalación (copy) + drift
        shell: bash
        run: |
          node scripts/install.mjs --copy --target "$RUNNER_TEMP/claude"
          node scripts/check-drift.mjs "$RUNNER_TEMP/claude"
          echo "instalación + drift OK en ${{ matrix.os }}"
```

- [ ] **Step 2: Verificación local del YAML (sintaxis)**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
node -e "const fs=require('fs');const y=fs.readFileSync('.github/workflows/canary.yml','utf8');if(!y.includes('windows-latest'))process.exit(1);console.log('workflow incluye windows-latest')"
```
(La validación real es la corrida en CI tras el push — Task 7.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/canary.yml
git commit -m "ci(canary): matriz ubuntu + windows con smoke de instalación cross-platform

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Documentación cross-platform

**Files:**
- Modify: `docs/installation.md`
- Modify: `README.md`
- Modify: `docs/adopcion-equipos.md`

**Interfaces:**
- Consumes: todo lo anterior (install.mjs, shims, CI, requisitos).

- [ ] **Step 1: `docs/installation.md` — reescribir para cross-platform**

Cambios requeridos (contenido, en español, preservando la estructura de 3 vías):
- **Elevar la Vía 1 (plugin) como la recomendada para TODOS, en especial Windows**: `/plugin marketplace add alyp-studio/coding_practices_alyp` + `/plugin install alyp-dev-standards@alyp-studio` — nativa de Claude Code, idéntica en macOS/Windows/Linux. Nota: el plugin instala los 8 skills + 4 agentes; los **artefactos runtime de token-savings** (statusline/hook/settings.json) NO los cablea el plugin — para eso, la Vía 2 (script) o cableo manual.
- **Vía 2 (script)**: comando universal `node scripts/install.mjs [--copy|--link] [--target DIR]`; los shims `./scripts/install.sh` (Unix) y `.\scripts\install.ps1` (Windows) sólo invocan Node. Quitar toda mención a que el instalador es bash/requiere `python3`.
- **Vía 3 (manual)**: sin cambios de fondo (copiar dirs completos), pero el ejemplo de copia debe funcionar en ambos OS o marcarse como Unix/Git-Bash.
- **Nueva sección "Requisitos por plataforma"**:
  - `node >= 20.11` para el instalador y la meta-QA (cross-platform).
  - **Windows — uso de skills**: Claude Code usa **Git for Windows (Git Bash)** para la herramienta Bash; instalalo para que los skills que corren `cp/grep/pnpm` funcionen. Si Git Bash no se detecta, configurá `CLAUDE_CODE_GIT_BASH_PATH` en `settings.json`. Sin Git Bash, Claude Code usa PowerShell y esos comandos POSIX fallan.
  - **token-savings (opcional)**: requiere **Python 3** (`python` o `python3`) en el PATH; el instalador lo detecta y, si falta, saltea el cableado con aviso.
- **Actualización** y **check-drift**: `node scripts/check-drift.mjs` (o los shims).
- Quitar toda referencia a `~/.claude/commands/` si quedara (ya no debería).

- [ ] **Step 2: `README.md`**

- En la sección de instalación / "Desarrollo del ecosistema": comando universal `node scripts/install.mjs --link`; mención a los shims.
- En prerequisitos: `node >= 20.11`; nota "cross-platform: macOS · Linux · Windows (instalador y meta-QA en Node)"; Windows-usa-Git-Bash para la herramienta Bash.
- Actualizar la referencia al canario: `node scripts/canary.mjs`, matriz ubuntu+windows en CI.

- [ ] **Step 3: `docs/adopcion-equipos.md`**

- En "opcionales" / soporte: agregar nota Windows — instalación y meta-QA son cross-platform (Node); el uso de skills con shell POSIX requiere Git for Windows; token-savings requiere Python 3.

- [ ] **Step 4: Verificar y commitear**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
grep -c "install.mjs" docs/installation.md   # Expected: >= 1
grep -ci "git for windows\|git bash" docs/installation.md   # Expected: >= 1
grep -c "commands/" docs/installation.md      # Expected: 0
git add docs/installation.md README.md docs/adopcion-equipos.md
git commit -m "docs: instalación y uso cross-platform (Windows) — plugin, install.mjs, Git Bash, Python opcional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Versión del ecosistema + CHANGELOG + plugin, verificación final y cierre

**Files:**
- Modify: `CHANGELOG.md`, `contracts/standards.example.yaml`, `.claude-plugin/plugin.json`, `README.md` (si lista versión del ecosistema)

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: release 2.1.0.

- [ ] **Step 1: Bump de versión del ecosistema**

- `contracts/standards.example.yaml`: `ecosistema: 2.0.0` → `ecosistema: 2.1.0`.
- `.claude-plugin/plugin.json`: `"version": "2.0.0"` → `"version": "2.1.0"`.
- Si `README.md` o docs nombran "ecosistema 2.0.0", actualizar a 2.1.0.

- [ ] **Step 2: Entrada CHANGELOG v2.1.0 (prepend bajo el título)**

```markdown
## v2.1.0 — 2026-07-06

### Soporte cross-platform (macOS · Linux · Windows)

- Instalador reescrito en Node (`scripts/install.mjs`) — reemplaza el bash; junctions sin admin en Windows, merge de `settings.json` en Node puro (sin dependencia de `python3`), detección de intérprete de Python para token-savings. `install.sh`/`install.ps1` quedan como shims.
- `check-drift.mjs` y `canary.mjs` portados a Node (cross-platform); shims `.sh` conservados.
- CI canario en matriz `ubuntu-latest` + `windows-latest` con smoke de instalación real.
- token-savings 1.0.1: hook usa tempdir portable (no `/tmp`); intérprete tolerante `python`/`python3`.
- Docs: vía plugin elevada como #1 cross-platform; requisitos por plataforma (Node ≥ 20.11; Git for Windows para la herramienta Bash; Python 3 opcional para token-savings).
- Boundary documentado: instalación y meta-QA 100% cross-platform; el uso de skills con shell POSIX requiere Git Bash en Windows (requisito de Claude Code).
```

- [ ] **Step 3: Verificación integral**

```bash
cd /Users/parb/Dev/alyp-studio/coding_practices_alyp
node scripts/lint-skills.mjs                 # Expected: 8 skills OK
node scripts/canary.mjs 2>&1 | tail -1       # Expected: CANARIO OK
node scripts/check-drift.mjs; echo "drift rc=$?"   # Expected: rc=0 (dev en link)
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'));console.log('plugin.json válido')"
grep -c "2.1.0" contracts/standards.example.yaml .claude-plugin/plugin.json CHANGELOG.md
```

- [ ] **Step 4: Commit + push + PR + tag**

```bash
git add CHANGELOG.md contracts/standards.example.yaml .claude-plugin/plugin.json README.md
git commit -m "chore: release 2.1.0 — soporte cross-platform Windows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin develop
gh pr create --repo alyp-studio/coding_practices_alyp --base main --head develop \
  --title "v2.1.0 — soporte cross-platform (macOS + Windows)" \
  --body "Instalador y meta-QA portados a Node (cross-platform), fix Python token-savings, CI matriz ubuntu+windows, docs de requisitos por plataforma. Ver CHANGELOG v2.1.0 y docs/plans/2026-07-06-cross-platform-windows.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Tras merge (decisión del usuario) + CI verde en ambos SO: `git tag -a v2.1.0 origin/main -m "..." && git push origin v2.1.0`.

---

## Fuera de alcance (decidido)

- **Reescribir cada snippet bash de los SKILL.md en PowerShell**: descartado — anti-DRY y contra el ethos del ecosistema; los snippets usan herramientas que existen en Git Bash (pnpm/npm/git/grep). Se documenta el requisito de Git for Windows (postura del propio Claude Code).
- **Empaquetar los artefactos de token-savings en el plugin**: el mecanismo `/plugin` instala skills+agentes, no cablea hooks/statusline/settings; queda vía script o manual (documentado).
- **lint-skills.mjs**: ya es cross-platform (`path.join`), sin cambios.
