// Núcleo puro del cálculo de radio de impacto. Sin I/O: todo lo testeable vive acá.
// Consume la forma del reporter `json` de dependency-cruiser.

/** Las nueve rutas del piso de riesgo mecánico. Fuente: alyp-exec/references/gates.md:72-76.
 *  El perfil de un repo puede AMPLIAR esta lista, nunca recortarla. */
export const PISO_RIESGO_PATTERNS = [
  /(^|\/)supabase\/migrations\//,
  /(^|\/)auth\//,
  /(^|\/)middleware\.ts$/,
  /(^|\/)rls\//,
  /\.policy\.sql$/,
  /(^|\/)\.env/,
  /(^|\/)webhooks\//,
  /(^|\/)pagos\//,
  /(^|\/)billing\//,
]

/** Los patrones del piso de riesgo que un grafo de imports JS/TS NO PUEDE VER (hallazgo V13).
 *  No es una limitación de la implementación: es una propiedad del grafo. Un .sql no es un
 *  módulo y nadie lo importa; un .env tampoco. Por eso el CLI EXIGE una declaración explícita
 *  (--extra) antes de emitir nada: el piso de riesgo tiene dos mitades y esta no sale del grafo. */
export const PATRONES_CIEGOS_AL_GRAFO = [
  {
    glob: 'supabase/migrations/**',
    patron: /(^|\/)supabase\/migrations\//,
    motivo: 'un .sql no es un módulo del grafo; además en esta flota vive en la raíz del repo, fuera de src/apps/packages/lib',
  },
  { glob: '**/*.policy.sql', patron: /\.policy\.sql$/, motivo: 'un .sql no es un módulo del grafo' },
  { glob: '.env*', patron: /(^|\/)\.env/, motivo: 'no es un módulo del grafo' },
]

/** Por encima de esto la "allowlist" deja de restringir: permite casi todo el repo y G2
 *  pasa en verde por construcción. Es un síntoma de tarea mal cortada o de depth excesivo. */
export const TECHO_ALLOWLIST = 40

const ES_TEST = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(tests?|__tests__)\//

/** modules → Map<archivo, [quienes lo importan]> */
export function buildReverseIndex(modules) {
  const rev = new Map()
  for (const m of modules) {
    for (const d of m.dependencies ?? []) {
      if (!d.resolved) continue
      if (!rev.has(d.resolved)) rev.set(d.resolved, [])
      rev.get(d.resolved).push(m.source)
    }
  }
  return rev
}

/** BFS inverso hasta `depth` saltos. Los tests salen en su propia lista:
 *  el contrato los excluye de `archivos:` (allowlist) pero los necesita para `verificacion:`. */
export function computeImpact(modules, target, depth = 2) {
  const rev = buildReverseIndex(modules)
  const visto = new Set([target])
  const alcanzados = []
  let frontera = [target]

  for (let nivel = 0; nivel < depth; nivel++) {
    const siguiente = []
    for (const nodo of frontera) {
      for (const padre of rev.get(nodo) ?? []) {
        if (visto.has(padre)) continue
        visto.add(padre)
        alcanzados.push(padre)
        // Un test es una HOJA: se reporta, pero no se propaga a través suyo. Sin esto, un
        // helper de tests mete en la allowlist código que la tarea no toca.
        if (!ES_TEST.test(padre)) siguiente.push(padre)
      }
    }
    if (siguiente.length === 0) break
    frontera = siguiente
  }

  const directas = modules.find((m) => m.source === target)?.dependencies ?? []

  return {
    target,
    dependents: alcanzados.filter((f) => !ES_TEST.test(f)).sort(),
    dependencies: directas.map((d) => d.resolved).filter(Boolean).sort(),
    tests: alcanzados.filter((f) => ES_TEST.test(f)).sort(),
  }
}

/** Aplica el piso de riesgo del gate G0 sobre una lista de archivos. Predicado puro. */
export function riskFloor(files) {
  const coincidencias = files.filter((f) => PISO_RIESGO_PATTERNS.some((p) => p.test(f)))
  return { nivel: coincidencias.length > 0 ? 2 : 0, coincidencias }
}

/** El piso de riesgo REAL: la unión de lo que vio el grafo y lo que el humano declaró.
 *  Devuelve por separado qué mitad detectó cada coincidencia, porque G0 necesita saber
 *  si el 2 salió de una medición o de una declaración — se auditan distinto. */
export function pisoDeRiesgo(allowlistGrafo, declarados = []) {
  const desde_grafo = riskFloor(allowlistGrafo).coincidencias
  const todos = [...new Set([...allowlistGrafo, ...declarados])]
  const { nivel, coincidencias } = riskFloor(todos)
  return {
    nivel,
    coincidencias,
    desde_grafo,
    desde_declaracion: coincidencias.filter((f) => !desde_grafo.includes(f)),
  }
}

/** Agrupa por los dos primeros segmentos de ruta. Alimenta el criterio "no toca 3 módulos". */
export function groupModules(files) {
  return [...new Set(files.map((f) => f.split('/').slice(0, 2).join('/')))]
}
