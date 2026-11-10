// Lectura pura de los archivos que el mod muestra: sin `$`, para poder probarla
// sola y para que register.tsx solo decida qué leer y cuándo.
import type { Job, Plan } from '../types'

export const HORA = 3_600_000
export const DIA = 24 * HORA

/** `ruta` es `raiz` o está debajo de ella. */
export const dentro = (ruta: string, raiz: string): boolean =>
  ruta === raiz || ruta.startsWith(raiz.endsWith('/') ? raiz : raiz + '/')

const LEDGER_ABS = /(\/[^\s'"`<>|;&]*?\/\.claude\/run\/[A-Za-z0-9._-]+)/g
const LEDGER_REL = /(?:^|[\s'"`=(])(\.\/)?(\.claude\/run\/[A-Za-z0-9._-]+)/g

/**
 * Ledgers de alyp-exec que nombra un texto (un comando, una ruta): absolutos tal
 * cual, relativos resueltos contra `cwd`. Así el mod sabe qué plan trabaja esta
 * sesión sin que nadie se lo diga.
 */
export const ledgersEn = (texto: string, cwd: string): string[] => {
  const out = new Set<string>()
  for (const m of texto.matchAll(LEDGER_ABS)) if (m[1]) out.add(m[1])
  for (const m of texto.matchAll(LEDGER_REL)) if (m[2] && cwd) out.add(`${cwd.replace(/\/$/, '')}/${m[2]}`)
  return [...out]
}

/**
 * El checkout principal de un worktree, leyendo su archivo `.git`
 * ("gitdir: /repo/.git/worktrees/<nombre>"). null si no es un worktree.
 */
export const repoPrincipal = (archivoGit: string): string | null => {
  const m = /^gitdir:\s*(.+?)\/\.git\/worktrees\/[^/\s]+\s*$/m.exec(archivoGit)
  return m?.[1] ?? null
}

/**
 * Si un job es "de este proyecto". Dentro de un repo git: el repo. Fuera de un
 * repo: lo que cuelga de la carpeta, salvo en carpetas contenedoras genéricas
 * (el home y su primer nivel, como ~/Dev), donde solo cuenta la misma carpeta:
 * desde ahí "debajo" son todos los clientes.
 */
export const jobDelProyecto = (jobCwd: string, raiz: string, esRepo: boolean, home: string): boolean => {
  if (!raiz || !jobCwd) return false
  if (esRepo) return dentro(jobCwd, raiz)
  const h = home.replace(/\/$/, '')
  const generica = h !== '' && (raiz === h || (dentro(raiz, h) && raiz.slice(h.length + 1).split('/').length < 2))
  return generica ? jobCwd === raiz : dentro(jobCwd, raiz)
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const txt = (v: unknown): string => (typeof v === 'string' ? v : '')
const fecha = (v: unknown): number => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : 0
}

/** progreso.json v1 (alyp-exec references/progreso.md) → Plan, o null si no es válido. */
export const planDeProgreso = (ledger: string, texto: string): Plan | null => {
  let d: Record<string, unknown>
  try {
    d = JSON.parse(texto) as Record<string, unknown>
  } catch {
    return null
  }
  const total = num(d.total)
  if (d.version !== 1 || total === 0) return null
  return {
    ledger,
    slug: txt(d.plan) || ledger.split('/').pop() || ledger,
    titulo: txt(d.titulo),
    repo: txt(d.repo),
    total,
    aceptadas: Math.min(num(d.aceptadas), total),
    enCurso: num(d.en_curso),
    bloqueadas: num(d.bloqueadas),
    ola: txt(d.ola),
    tarea: txt(d.tarea_actual),
    actualizado: fecha(d.actualizado),
    isEstimado: false,
  }
}

const ID = /^\|?\s*([A-Z]{1,3}\d+[a-z]?)\s*\|?\s+([^\s|]+)/

const clase = (estado: string): 'aceptada' | 'bloqueada' | 'pendiente' | 'en_curso' => {
  const s = estado.toLowerCase()
  if (s.startsWith('aceptada') && !s.includes('condic')) return 'aceptada'
  if (s.includes('bloq')) return 'bloqueada'
  if (s === 'pendiente') return 'pendiente'
  return 'en_curso'
}

/**
 * Lectura tolerante de estado.md cuando falta progreso.json. Toma la primera
 * línea de cada tarea (los ledgers en uso escriben lo nuevo arriba) y cuenta
 * solo las tareas que aparecen: por eso el resultado va marcado como estimado.
 */
export const planDeEstado = (ledger: string, texto: string, mtimeMs: number): Plan | null => {
  const visto = new Map<string, string>()
  for (const linea of texto.split('\n')) {
    const m = ID.exec(linea)
    const id = m?.[1]
    const estado = m?.[2]
    if (id && estado && !visto.has(id)) visto.set(id, estado)
  }
  if (visto.size === 0) return null
  const cuenta = { aceptada: 0, bloqueada: 0, pendiente: 0, en_curso: 0 }
  for (const estado of visto.values()) cuenta[clase(estado)]++
  const slug = ledger.split('/').pop() || ledger
  return {
    ledger,
    slug,
    titulo: '',
    repo: '',
    total: visto.size,
    aceptadas: cuenta.aceptada,
    enCurso: cuenta.en_curso,
    bloqueadas: cuenta.bloqueada,
    ola: '',
    tarea: '',
    actualizado: mtimeMs,
    isEstimado: true,
  }
}

/** Se muestra si no está terminado y es de la última semana, o terminó hace menos de un día. */
export const planVigente = (p: Plan, ahora: number): boolean => {
  const edad = ahora - p.actualizado
  if (p.aceptadas >= p.total) return edad < DIA
  return edad < 7 * DIA
}

/** state.json de un job → Job, o null si no se puede leer. */
export const jobDeEstado = (id: string, texto: string, sesion: string): Job | null => {
  let d: Record<string, unknown>
  try {
    d = JSON.parse(texto) as Record<string, unknown>
  } catch {
    return null
  }
  const state = txt(d.state)
  if (!state) return null
  return {
    id,
    name: txt(d.name) || txt(d.intent).slice(0, 40) || id,
    state,
    detail: txt(d.detail).replace(/\s+/g, ' ').slice(0, 120),
    cwd: txt(d.cwd),
    updatedAt: fecha(d.updatedAt),
    isMine: sesion !== '' && txt(d.sessionId) === sesion,
  }
}

const ORDEN: Record<string, number> = { working: 0, blocked: 1, failed: 2 }

/** Trabajando o esperando input en las últimas 24 h, más los fallidos de la última hora. */
export const jobsVisibles = (lista: Job[], ahora: number, max = 8): Job[] =>
  lista
    .filter(j => {
      const edad = ahora - j.updatedAt
      if (j.state === 'working' || j.state === 'blocked') return edad < DIA
      if (j.state === 'failed') return edad < HORA
      return false
    })
    .sort((a, b) => (ORDEN[a.state] ?? 9) - (ORDEN[b.state] ?? 9) || b.updatedAt - a.updatedAt)
    .slice(0, max)

/** Nombre y fases del `meta` literal de un script de Workflow. */
export const metaDeWorkflow = (script: string): { name: string; phases: string[] } => {
  const inicio = script.indexOf('export const meta')
  if (inicio < 0) return { name: '', phases: [] }
  const bloque = script.slice(inicio, inicio + 4000)
  const fin = bloque.search(/\n\}/)
  const meta = fin > 0 ? bloque.slice(0, fin) : bloque
  const name = /name\s*:\s*['"`]([^'"`]+)['"`]/.exec(meta)?.[1] ?? ''
  const phases = [...meta.matchAll(/title\s*:\s*['"`]([^'"`]+)['"`]/g)].flatMap(m => (m[1] ? [m[1]] : []))
  return { name, phases }
}

/** Barra de `ancho` celdas para `hecho` de `total`. */
export const barra = (hecho: number, total: number, ancho: number): [string, string] => {
  const llenas = total > 0 ? Math.max(0, Math.min(ancho, Math.round((ancho * hecho) / total))) : 0
  return ['█'.repeat(llenas), '░'.repeat(ancho - llenas)]
}

export const pct = (hecho: number, total: number): number => (total > 0 ? Math.round((100 * hecho) / total) : 0)

/** "3m", "2h", "1d" desde `desde` hasta `ahora`. */
export const hace = (desde: number, ahora: number): string => {
  const s = Math.max(0, Math.round((ahora - desde) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
