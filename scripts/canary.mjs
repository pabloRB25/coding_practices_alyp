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
