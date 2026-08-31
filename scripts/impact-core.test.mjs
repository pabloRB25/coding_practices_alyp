import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReverseIndex, computeImpact, riskFloor, pisoDeRiesgo, groupModules,
  PATRONES_CIEGOS_AL_GRAFO,
} from './impact-core.mjs'

const FIXTURE = [
  { source: 'src/lib/invitations.ts', dependencies: [{ resolved: 'src/lib/db.ts' }] },
  { source: 'src/app/admin/team/page.tsx', dependencies: [{ resolved: 'src/lib/invitations.ts' }] },
  { source: 'src/app/admin/team/actions.ts', dependencies: [{ resolved: 'src/lib/invitations.ts' }] },
  { source: 'src/app/admin/layout.tsx', dependencies: [{ resolved: 'src/app/admin/team/page.tsx' }] },
  { source: 'tests/invitations.spec.ts', dependencies: [{ resolved: 'src/lib/invitations.ts' }] },
  { source: 'src/lib/db.ts', dependencies: [] },
]

test('buildReverseIndex mapea cada modulo a quienes lo importan', () => {
  const rev = buildReverseIndex(FIXTURE)
  assert.deepEqual(
    rev.get('src/lib/invitations.ts').sort(),
    ['src/app/admin/team/actions.ts', 'src/app/admin/team/page.tsx', 'tests/invitations.spec.ts']
  )
})

test('computeImpact a depth 1 no arrastra el layout', () => {
  const r = computeImpact(FIXTURE, 'src/lib/invitations.ts', 1)
  assert.ok(!r.dependents.includes('src/app/admin/layout.tsx'))
  assert.ok(r.dependents.includes('src/app/admin/team/page.tsx'))
})

test('computeImpact a depth 2 si arrastra el layout', () => {
  const r = computeImpact(FIXTURE, 'src/lib/invitations.ts', 2)
  assert.ok(r.dependents.includes('src/app/admin/layout.tsx'))
})

test('computeImpact separa los tests de los dependents', () => {
  const r = computeImpact(FIXTURE, 'src/lib/invitations.ts', 2)
  assert.deepEqual(r.tests, ['tests/invitations.spec.ts'])
  assert.ok(!r.dependents.includes('tests/invitations.spec.ts'))
})

// Un test es una HOJA del recorrido: se reporta, pero no se propaga a traves suyo.
// Sin esta regla, un helper de tests infla la allowlist con codigo que la tarea no toca.
test('computeImpact no propaga a traves de un archivo de test', () => {
  const conHelper = [
    ...FIXTURE,
    { source: 'tests/helpers/factory.ts', dependencies: [{ resolved: 'src/lib/invitations.ts' }] },
    { source: 'src/app/dev/seed.ts', dependencies: [{ resolved: 'tests/helpers/factory.ts' }] },
  ]
  const r = computeImpact(conHelper, 'src/lib/invitations.ts', 3)
  assert.ok(r.tests.includes('tests/helpers/factory.ts'))
  assert.ok(!r.dependents.includes('src/app/dev/seed.ts'), 'seed.ts entro por detras de un test')
})

test('computeImpact no entra en loop con dependencias circulares', () => {
  const ciclo = [
    { source: 'a.ts', dependencies: [{ resolved: 'b.ts' }] },
    { source: 'b.ts', dependencies: [{ resolved: 'a.ts' }] },
  ]
  const r = computeImpact(ciclo, 'a.ts', 10)
  assert.deepEqual(r.dependents, ['b.ts'])
})

test('computeImpact con target inexistente devuelve vacio, no lanza', () => {
  const r = computeImpact(FIXTURE, 'src/no/existe.ts', 2)
  assert.deepEqual(r.dependents, [])
  assert.deepEqual(r.tests, [])
})

test('riskFloor detecta migraciones', () => {
  const r = riskFloor(['src/lib/invitations.ts', 'supabase/migrations/0003_invites.sql'])
  assert.equal(r.nivel, 2)
  assert.deepEqual(r.coincidencias, ['supabase/migrations/0003_invites.sql'])
})

test('riskFloor detecta las nueve rutas del gate G0', () => {
  const casos = [
    'supabase/migrations/x.sql', 'src/auth/session.ts', 'middleware.ts',
    'src/rls/policies.ts', 'db/team.policy.sql', '.env.local',
    'src/webhooks/stripe.ts', 'src/pagos/checkout.ts', 'src/billing/plan.ts',
  ]
  for (const c of casos) assert.equal(riskFloor([c]).nivel, 2, `fallo con ${c}`)
})

test('riskFloor es 0 cuando nada matchea', () => {
  assert.equal(riskFloor(['src/lib/invitations.ts', 'src/app/admin/team/page.tsx']).nivel, 0)
})

test('groupModules agrupa por los dos primeros segmentos', () => {
  const m = groupModules(['src/lib/invitations.ts', 'src/app/admin/team/page.tsx', 'src/lib/db.ts'])
  assert.deepEqual(m.sort(), ['src/app', 'src/lib'])
})

// --- V13: el punto ciego, codificado como assert para que nadie lo redescubra ---

test('REGRESION V13: el grafo solo NUNCA levanta una migracion', () => {
  // La allowlist que sale del grafo jamas contiene un .sql: no es un modulo.
  const soloGrafo = computeImpact(FIXTURE, 'src/lib/invitations.ts', 2)
  const allowlist = ['src/lib/invitations.ts', ...soloGrafo.dependents]
  assert.equal(riskFloor(allowlist).nivel, 0,
    'si esto da 2, el fixture cambio y el test dejo de probar el punto ciego')
})

test('pisoDeRiesgo levanta a 2 cuando la declaracion aporta la migracion', () => {
  const allowlist = ['src/lib/invitations.ts', 'src/app/admin/team/page.tsx']
  const r = pisoDeRiesgo(allowlist, ['supabase/migrations/0003_invites.sql'])
  assert.equal(r.nivel, 2)
  assert.deepEqual(r.desde_grafo, [])
  assert.deepEqual(r.desde_declaracion, ['supabase/migrations/0003_invites.sql'])
})

test('pisoDeRiesgo distingue que mitad detecto cada coincidencia', () => {
  const r = pisoDeRiesgo(['src/auth/session.ts'], ['.env.local'])
  assert.equal(r.nivel, 2)
  assert.deepEqual(r.desde_grafo, ['src/auth/session.ts'])
  assert.deepEqual(r.desde_declaracion, ['.env.local'])
})

test('PATRONES_CIEGOS_AL_GRAFO cubre las tres rutas invisibles', () => {
  const globs = PATRONES_CIEGOS_AL_GRAFO.map((c) => c.glob)
  assert.deepEqual(globs, ['supabase/migrations/**', '**/*.policy.sql', '.env*'])
  for (const c of PATRONES_CIEGOS_AL_GRAFO) assert.ok(c.motivo.length > 0)
})
