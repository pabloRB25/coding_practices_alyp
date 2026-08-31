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

// Los skills se descubren del repo, no se enumeran: una lista hardcodeada se desincroniza
// en silencio. Pasó con alyp-graph — se agregó a skills/ y el installer siguió reportando
// "Instalación completa" sin instalarlo, que es el peor modo de falla posible acá.
// check-drift.mjs ya recorre todo skills/; derivar la lista del disco los mantiene de
// acuerdo por construcción en vez de por disciplina.
const SKILLS = readdirSync(join(REPO_DIR, 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

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
  mkdirSync(join(target, 'scripts'), { recursive: true });
  const artefactos = [
    [join(ats, 'statusline-context.py'), join(target, 'statusline-context.py')],
    [join(ats, 'hooks', 'context-guard.py'), join(target, 'hooks', 'context-guard.py')],
    [join(ats, 'hooks', 'precompact-preserve.py'), join(target, 'hooks', 'precompact-preserve.py')],
    [join(ats, 'token-audit.sh'), join(target, 'scripts', 'token-audit.sh')],
    [join(ats, 'verificar-hooks.py'), join(target, 'scripts', 'verificar-hooks.py')],
    [join(ats, 'RTK.md'), join(target, 'RTK.md')],
  ];
  for (const [src, dst] of artefactos) if (existsSync(src)) place(src, dst, 'file');
  if (!isWin && mode === 'copy') {
    for (const f of ['statusline-context.py', join('hooks', 'context-guard.py'),
                     join('hooks', 'precompact-preserve.py'), join('scripts', 'token-audit.sh'),
                     join('scripts', 'verificar-hooks.py')]) {
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
  // PreCompact: preservar decisiones/caminos descartados antes de compactar.
  // OJO: un PreCompact que falla ABORTA la compactación ("Compaction blocked by
  // PreCompact hook"), por eso en Unix va con guarda `test -f … || exit 0`.
  const pc = fwd(join(target, 'hooks', 'precompact-preserve.py'));
  d.hooks.PreCompact = d.hooks.PreCompact ?? [];
  const prePresent = d.hooks.PreCompact.some(
    (b) => (b.hooks ?? []).some((h) => (h.command ?? '').includes('precompact-preserve')),
  );
  if (!prePresent) {
    const cmd = isWin ? `${py} "${pc}"` : `test -f ${pc} && ${py} ${pc} || exit 0`;
    d.hooks.PreCompact.push({ hooks: [{ type: 'command', command: cmd, timeout: 10 }] });
  }
  writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
  console.log(`✓ settings.json: statusLine + UserPromptSubmit + PreCompact mergeados (intérprete: ${py}; backup .bak.*)`);
}
