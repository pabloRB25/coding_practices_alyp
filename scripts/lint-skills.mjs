#!/usr/bin/env node
// Meta-QA estructural: valida frontmatter, grafo requires/provides y assets referenciados.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..', 'skills');
const errores = [];
const skills = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
const provistos = new Set();
const requeridos = [];

// Un `requires:` también puede apuntar a un contrato (contracts/*.md): un skill
// declara así que es perfil de / depende de un contrato agnóstico, no solo de
// otro skill o capacidad. Sumamos los contratos existentes al grafo — si el
// contrato no existe en disco, el requires sigue fallando (dependencia real).
const contractsDir = join(root, '..', 'contracts');
if (existsSync(contractsDir)) {
  for (const f of readdirSync(contractsDir)) {
    if (f.endsWith('.md')) provistos.add(f.slice(0, -3));
  }
}

for (const dir of skills) {
  const ruta = join(root, dir, 'SKILL.md');
  if (!existsSync(ruta)) { errores.push(`${dir}: falta SKILL.md`); continue; }
  const texto = readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
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
