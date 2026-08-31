#!/usr/bin/env node
// scripts/generate-feature-index.mjs
// Uso: node scripts/generate-feature-index.mjs [--check]
//
// Implementa el invariante I10 de contracts/code-standard.md: el índice de
// dominios se DERIVA del código, nunca se escribe a mano.
//
//   (sin flags)   regenera el índice dentro de CLAUDE.md
//   --check       no escribe; exit 1 si el índice está desactualizado (gate)

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CHECK = process.argv.includes('--check');
const CLAUDE_MD = 'CLAUDE.md';
const INICIO = '<!-- FEATURE-INDEX:START -->';
const FIN = '<!-- FEATURE-INDEX:END -->';

// Roles del estándar: <dominio>.<rol>.ts (FASE 3 del skill)
const ROLES = ['schema', 'queries', 'actions', 'controller', 'test'];

// Detectar src dir (monorepo vs simple) — mismo criterio que new-feature.mjs
const srcBase = existsSync('apps/app/src') ? 'apps/app/src' : 'src';
const featuresDir = join(srcBase, 'features');

if (!existsSync(featuresDir)) {
  console.error(`❌ No existe ${featuresDir} — ¿corriste el bootstrap del estándar?`);
  process.exit(1);
}

/** Nombres exportados por el barrel: la API pública real del dominio. */
function apiPublica(dir) {
  const barrel = join(dir, 'index.ts');
  if (!existsSync(barrel)) return [];
  const src = readFileSync(barrel, 'utf8');
  const nombres = new Set();

  // export { a, type B, c as d } from './x'
  for (const m of src.matchAll(/export\s*{([^}]*)}/g)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (nombre) nombres.add(nombre.trim());
    }
  }
  // export const|function|class|type|interface X
  for (const m of src.matchAll(/export\s+(?:const|function|class|type|interface)\s+(\w+)/g)) {
    nombres.add(m[1]);
  }
  return [...nombres].filter(Boolean).sort();
}

/** Roles presentes y faltantes según los archivos del dominio. */
function rolesDe(dir, dominio) {
  const archivos = readdirSync(dir);
  const presentes = ROLES.filter((rol) => archivos.includes(`${dominio}.${rol}.ts`));
  return { presentes, faltaTest: !presentes.includes('test') };
}

const dominios = readdirSync(featuresDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const filas = dominios.map((dominio) => {
  const dir = join(featuresDir, dominio);
  const { presentes, faltaTest } = rolesDe(dir, dominio);
  const api = apiPublica(dir);
  const roles = presentes.join(' · ') || '—';
  const alerta = faltaTest ? ' ⚠️ sin test' : '';
  const publico = api.length ? api.join(', ') : '⚠️ barrel vacío o ausente';
  return `| \`${dominio}\` | \`${dir}/\` | ${roles}${alerta} | ${publico} |`;
});

const tabla = dominios.length
  ? [
      '| Dominio | Ubicación | Roles | API pública (barrel) |',
      '|---------|-----------|-------|----------------------|',
      ...filas,
    ].join('\n')
  : '_Sin dominios todavía — crear el primero con `pnpm new-feature <dominio>`._';

const bloque = [
  INICIO,
  '<!-- Generado por scripts/generate-feature-index.mjs — no editar a mano (I10). -->',
  '',
  tabla,
  '',
  `_${dominios.length} dominio(s) · regenerar con \`pnpm feature-index\`_`,
  FIN,
].join('\n');

if (!existsSync(CLAUDE_MD)) {
  console.error(`❌ No existe ${CLAUDE_MD} — generalo primero (FASE 7 del estándar).`);
  process.exit(1);
}

const doc = readFileSync(CLAUDE_MD, 'utf8');
const desde = doc.indexOf(INICIO);
const hasta = doc.indexOf(FIN);

if (desde === -1 || hasta === -1) {
  console.error(
    `❌ Faltan los marcadores del índice en ${CLAUDE_MD}.\n` +
      `   Agregá estas dos líneas donde deba ir el índice:\n\n   ${INICIO}\n   ${FIN}\n`
  );
  process.exit(1);
}

const nuevo = doc.slice(0, desde) + bloque + doc.slice(hasta + FIN.length);

if (CHECK) {
  if (nuevo !== doc) {
    console.error(
      '❌ El índice de dominios está desactualizado (I10).\n' +
        '   Corré `pnpm feature-index` y commiteá el resultado.'
    );
    process.exit(1);
  }
  console.log(`✅ Índice de dominios al día (${dominios.length} dominios).`);
  process.exit(0);
}

writeFileSync(CLAUDE_MD, nuevo);
console.log(`✅ Índice regenerado: ${dominios.length} dominio(s) en ${CLAUDE_MD}.`);
