#!/usr/bin/env node
// Uso: node graph-impact.mjs --repo <dir> --file <ruta-relativa> --extra <lista|ninguno> [--depth 2] [--json]
//
// Corre dependency-cruiser ON-DEMAND. No persiste índice: si el costo de consulta llega a
// doler, ESA es la evidencia que justifica un índice — no antes.
//
// --extra es OBLIGATORIO a propósito (V13). El grafo no puede ver supabase/migrations/,
// *.policy.sql ni .env*. Si el CLI aceptara correr sin declaración, emitiría `riesgo_piso: 0`
// justo en el caso que este plan existe para atrapar, y con formato de evidencia. Preferimos
// que no emita nada antes que emitir un cero que no midió.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  computeImpact, pisoDeRiesgo, groupModules,
  PATRONES_CIEGOS_AL_GRAFO, TECHO_ALLOWLIST,
} from './impact-core.mjs'

function arg(nombre, def) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i === -1 ? def : process.argv[i + 1]
}

const repo = path.resolve(arg('repo', process.cwd()))
const file = arg('file')
const extra = arg('extra')
const depth = Number(arg('depth', 2))
const asJson = process.argv.includes('--json')

if (!file) {
  console.error('Falta --file. Uso: --repo <dir> --file <ruta-relativa> --extra <lista|ninguno> [--depth 2] [--json]')
  process.exit(2)
}
if (!existsSync(path.join(repo, file))) {
  console.error(`No existe ${file} dentro de ${repo}`)
  process.exit(2)
}

// --- El gate que hace imposible el cero silencioso (V13) ---
if (!extra) {
  console.error(`
FALTA --extra. El grafo de imports NO PUEDE VER estas rutas del piso de riesgo G0:
`)
  for (const c of PATRONES_CIEGOS_AL_GRAFO) console.error(`  ${c.glob.padEnd(24)} ${c.motivo}`)
  console.error(`
Declaralas vos, porque el piso de riesgo de G0 se calcula sobre la allowlist y esta mitad
no sale del grafo:

  --extra supabase/migrations/0007_x.sql,supabase/seed.sql   → la tarea toca estos archivos
  --extra ninguno                                            → la tarea NO toca ninguno

"ninguno" es una declaración, no un default: queda registrada en la salida y G0 la audita.
Sin --extra este comando no emite bloque pegable.
`)
  process.exit(3)
}
const declarados = extra === 'ninguno'
  ? []
  : extra.split(',').map((f) => f.trim()).filter(Boolean)

for (const d of declarados) {
  if (!existsSync(path.join(repo, d))) {
    console.error(`⚠ --extra declara ${d}, que todavía no existe en ${repo}.`)
    console.error('  Si es un archivo que la tarea VA A CREAR, está bien: seguí. Si es un typo, corregilo.')
  }
}

// Candidatas ampliadas: la flota mezcla App Router con src/ y App Router en la raíz.
// fenix-demo no tiene src/ — con la lista vieja se escaneaban 2 módulos y el radio salía vacío.
const CANDIDATAS = ['src', 'apps', 'packages', 'lib', 'app', 'components', 'domain',
  'services', 'server', 'features', 'hooks', 'contexts', 'store', 'actions', 'db', 'types', 'utils',
  // Los tests entran al escaneo a propósito: el campo `tests` de la salida es lo que
  // alimenta `verificacion:` del contrato. Sin ellos ese campo sale siempre vacío.
  'tests', 'test', '__tests__', 'e2e', 'spec', 'cypress']
const raices = CANDIDATAS.filter((d) => existsSync(path.join(repo, d)))
// La raíz del archivo objetivo entra SIEMPRE, esté o no en las candidatas: escanear sin ella
// produce un radio vacío que es indistinguible de "no impacta a nadie".
const raizObjetivo = file.split('/')[0]
if (raizObjetivo !== file && !raices.includes(raizObjetivo) && existsSync(path.join(repo, raizObjetivo))) {
  raices.push(raizObjetivo)
}
// Next.js admite middleware.ts en la raíz del repo, fuera de las raíces de código. Es una de
// las nueve rutas de riesgo 2: si existe, entra al escaneo explícitamente.
if (existsSync(path.join(repo, 'middleware.ts'))) raices.push('middleware.ts')

if (raices.length === 0) {
  console.error(`No encontré raíces de código (src/apps/packages/lib) en ${repo}`)
  process.exit(2)
}

// dependency-cruiser decide qué extensiones puede escanear con require.resolve('typescript')
// resuelto DESDE SU PROPIA ubicación (el árbol efímero de `npx -y`), no desde `repo`. Sin esto,
// .ts/.tsx nunca entran a `scannableExtensions` (src/extract/transpile/meta.mjs) y:
//   - un DIRECTORIO como argumento filtra por extensión escaneable -> 0 módulos (bug reportado).
//   - un ARCHIVO .tsx pasado directo bypassea ese filtro -> aparenta 1 módulo, pero el parser
//     TypeScript tampoco está disponible y devuelve 0 dependencias: grafo con forma de evidencia
//     que no midió nada (el mismo patrón que --extra existe para atrapar, del otro lado).
// NODE_PATH apuntando a un node_modules que tenga `typescript` hace que esa resolución encuentre
// UN typescript real (createRequire en try-import-available.mjs sí respeta NODE_PATH). Probado:
// intentar co-instalar typescript vía `npx -p dependency-cruiser@16 -p typescript` es indistinto
// en npm 11 (el arborist descarta el segundo -p silenciosamente) — no es una vía confiable.
//
// En un monorepo pnpm (nomi_v3) el `node_modules/typescript` de la RAÍZ no existe: pnpm no
// hoistea si el root package.json no lo declara — vive como symlink dentro de cada paquete
// (p.ej. apps/app/node_modules/typescript -> …/.pnpm/typescript@5.8.3/…). Por eso caminamos
// desde el directorio del archivo objetivo hacia la raíz, igual que la resolución real de
// Node, en vez de mirar únicamente `repo/node_modules`.
function encontrarNodeModulesConTypescript(repoDir, archivoRelativo) {
  const repoAbs = path.resolve(repoDir)
  let dir = path.dirname(path.join(repoAbs, archivoRelativo))
  for (;;) {
    if (existsSync(path.join(dir, 'node_modules', 'typescript'))) return path.join(dir, 'node_modules')
    if (dir === repoAbs) break
    const padre = path.dirname(dir)
    if (padre === dir) break
    dir = padre
  }
  return ''
}
const nodePathExtra = encontrarNodeModulesConTypescript(repo, file)
const envConDepcruise = {
  ...process.env,
  NODE_PATH: [nodePathExtra, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
}

let salida
try {
  salida = execFileSync(
    'npx',
    [
      '-y', 'dependency-cruiser@16',
      '--output-type', 'json',
      '--no-config',
      '--do-not-follow', 'node_modules',
      '--exclude', 'node_modules|\\.next|\\.turbo|dist|build|coverage',
      ...(existsSync(path.join(repo, 'tsconfig.json')) ? ['--ts-config', 'tsconfig.json'] : []),
      ...raices,
    ],
    { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: envConDepcruise }
  )
} catch (e) {
  // depcruise sale != 0 cuando hay violaciones de reglas, pero igual emite el JSON.
  salida = e.stdout
  if (!salida) {
    console.error('dependency-cruiser falló sin producir salida:\n' + (e.stderr ?? e.message))
    process.exit(1)
  }
}

const modules = JSON.parse(salida).modules ?? []
if (modules.length === 0) {
  console.error('dependency-cruiser devolvió 0 módulos. Revisá las raíces o el tsconfig.')
  process.exit(1)
}

// El archivo objetivo TIENE que estar en el grafo. Si no está, computeImpact devuelve vacío y
// el CLI emitiría `archivos:` con una sola línea y piso 0 — indistinguible de "no impacta a nadie".
// Es la patología de V13 en la otra mitad: una salida con forma de evidencia que no midió nada.
if (!modules.some((m) => m.source === file)) {
  console.error(`\n${file} NO entró al grafo (${modules.length} módulos escaneados desde: ${raices.join(', ')}).`)
  console.error('Un radio calculado sin el archivo objetivo es VACÍO, no es 0. No se emite bloque pegable.')
  console.error('Revisá: ¿el path es relativo a la raíz del repo? ¿tsconfig resuelve los alias?')
  process.exit(5)
}

const impacto = computeImpact(modules, file, depth)
const allowlistGrafo = [file, ...impacto.dependents]
const allowlist = [...new Set([...allowlistGrafo, ...declarados])]
const piso = pisoDeRiesgo(allowlistGrafo, declarados)
const modulos = groupModules(allowlist)
const excedeTecho = allowlist.length > TECHO_ALLOWLIST

const resultado = {
  ...impacto,
  allowlist,
  declarados,
  modulos,
  riesgo_piso: piso.nivel,
  piso_desde_grafo: piso.desde_grafo,
  piso_desde_declaracion: piso.desde_declaracion,
  excede_techo: excedeTecho,
}

if (asJson) {
  console.log(JSON.stringify(resultado, null, 2))
  process.exit(0)
}

console.log(`# radio de impacto de ${file} (depth=${depth}, ${modules.length} módulos analizados)\n`)
console.log('archivos:')
for (const f of allowlist) {
  console.log(`  - ${f}${declarados.includes(f) && !allowlistGrafo.includes(f) ? '   # declarado, no visto por el grafo' : ''}`)
}
console.log(`\n# tests que lo ejercen (NO van en archivos:, van en verificacion:)`)
for (const t of impacto.tests) console.log(`  - ${t}`)
console.log(`\n# módulos tocados: ${modulos.join(', ')}${modulos.length > 1 ? '  ⚠ más de uno' : ''}`)
console.log(`# piso de riesgo mecánico: ${piso.nivel}`)
if (piso.desde_grafo.length) console.log(`#   medido por el grafo:   ${piso.desde_grafo.join(', ')}`)
if (piso.desde_declaracion.length) console.log(`#   aportado por --extra:  ${piso.desde_declaracion.join(', ')}`)
if (piso.nivel === 0) {
  console.log(`#   ⚠ este 0 vale SOLO porque declaraste "--extra ninguno". El grafo no puede`)
  console.log(`#     ver ${PATRONES_CIEGOS_AL_GRAFO.map((c) => c.glob).join(', ')} — G0 audita esa declaración.`)
}
if (impacto.tests.length === 0) console.log(`\n# ⚠ ningún test importa este archivo — 'verificacion:' no tiene de dónde salir`)
if (excedeTecho) {
  console.log(`\n# 🔴 ${allowlist.length} archivos supera el techo de ${TECHO_ALLOWLIST}: esto ya no restringe nada.`)
  console.log(`#    G2 pasaría en verde por construcción. Bajá --depth a 1 o partí la tarea.`)
}
process.exit(excedeTecho ? 4 : 0)
