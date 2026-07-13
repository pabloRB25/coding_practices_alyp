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
