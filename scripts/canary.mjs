#!/usr/bin/env node
// Canario cross-platform del ecosistema. 3 pasos:
//   1) lint estructural (lint-skills.mjs)
//   2) los assets de logging compilan bajo tsc strict
//   3) la config ESLint agentic DEBE detectar console desnudo + catch vacío en la
//      fixture (status===1 + ruleIds), Y NO marcar un archivo limpio (control
//      negativo, status===0) — así se distingue detección real de un eslint
//      crasheado (status 2 / sin exit limpio), que antes se leía como "pass".
//      Corre en su PROPIO proyecto temporal (node_modules aislado) para que el
//      typescript@latest instalado en el paso 2 no contamine la resolución del
//      parser de eslint.
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const work = mkdtempSync(join(tmpdir(), 'alyp-canary-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

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
  // Proyecto propio, separado de `proj` (paso 2): node_modules aislado para que
  // el typescript@latest de tsc no pise la resolución del parser de eslint.
  const eslintProj = join(work, 'eslint-proj');
  mkdirSync(join(eslintProj, 'src'), { recursive: true });
  writeFileSync(join(eslintProj, 'package.json'), JSON.stringify({ name: 'canary-eslint-proj', private: true }, null, 2) + '\n');
  copyFileSync(join(REPO_DIR, 'canary', 'fixture', 'src', 'quiebra.ts'), join(eslintProj, 'src', 'quiebra.ts'));
  // Control negativo: código limpio, sin console ni catch vacío.
  writeFileSync(join(eslintProj, 'src', 'control-limpio.ts'), 'export const ok = (): number => 1;\n');
  // Combo pineado y auto-consistente: eslint@8 + @typescript-eslint/parser@8
  // (peer typescript >=4.8.4 <6.1.0) + typescript@5.6.3.
  run(npm, ['install', '--no-save', '--silent', 'eslint@8', '@typescript-eslint/parser@8', 'typescript@5.6.3'], eslintProj);
  const assetRc = join(REPO_DIR, 'skills', 'agentic-logging', 'assets', '.eslintrc.agentic.cjs').replace(/\\/g, '/');
  writeFileSync(join(eslintProj, '.eslintrc.cjs'),
    `const base = require(${JSON.stringify(assetRc)});\n` +
    `module.exports = { ...base, parser: '@typescript-eslint/parser', ` +
    `parserOptions: { ecmaVersion: 2022, sourceType: 'module' }, ` +
    `rules: { ...base.rules, 'no-console': 'error' } };\n`);

  const runEslintJson = (target) => execFileSync(
    npx, ['eslint', '--no-eslintrc', '-c', '.eslintrc.cjs', '--format', 'json', target],
    { cwd: eslintProj, encoding: 'utf8', shell: process.platform === 'win32' },
  );

  // 3a) fixture: DEBE reportar violaciones → eslint sale con status 1 (no 0, no crash).
  let resultado;
  try {
    runEslintJson('src/quiebra.ts');
    console.error('✗ el lint DEBIÓ marcar violaciones en quiebra.ts (salió 0 — ningún problema detectado)');
    process.exit(1);
  } catch (err) {
    if (err.status !== 1) {
      console.error(`✗ eslint crasheó / config rota — no se pudo verificar la detección (status=${err.status ?? 'sin status'})`);
      if (err.stderr) console.error(String(err.stderr).trim());
      process.exit(1);
    }
    resultado = JSON.parse(err.stdout)[0];
  }

  const ruleIds = resultado.messages.map((m) => m.ruleId);
  const faltantes = ['no-console', 'no-empty'].filter((r) => !ruleIds.includes(r));
  if (faltantes.length) {
    console.error(`✗ eslint marcó violaciones pero faltan reglas esperadas: ${faltantes.join(', ')} (detectadas: ${ruleIds.join(', ') || 'ninguna'})`);
    process.exit(1);
  }
  console.log(`✓ eslint agentic marca las violaciones esperadas (${ruleIds.join(', ')})`);

  // 3b) control negativo: código limpio NO debe generar violaciones → status 0.
  try {
    runEslintJson('src/control-limpio.ts');
  } catch (err) {
    console.error(`✗ control negativo falló — eslint marcó código limpio como violación o crasheó (status=${err.status ?? 'sin status'}); la config no discrimina bien vs. bueno`);
    if (err.stderr) console.error(String(err.stderr).trim());
    process.exit(1);
  }
  console.log('✓ control negativo OK (código limpio no genera violaciones)');

  console.log('CANARIO OK');
} finally {
  rmSync(work, { recursive: true, force: true });
}
