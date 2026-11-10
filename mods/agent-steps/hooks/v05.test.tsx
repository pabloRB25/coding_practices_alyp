import { expect, mock, test } from 'claude-code/testing'

const AHORA = Date.parse('2026-11-10T19:00:00Z')
const REPO = '/Users/x/proj'
const CFG = '/Users/x/.claude'

const PANE = {
  plugin: 'agent-steps',
  component: 'Pane',
  requestId: 'agent-steps',
  surface: 'terminal',
  props: {
    title: 'Pasos',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
  viewport: { rows: 60, columns: 160 },
} as const

type Archivos = Record<string, string>

/** Un disco falso: `archivos` por ruta absoluta; las carpetas salen de las rutas. */
type Opts = { raiz?: string; esRepo?: boolean }

const setup = (on: any, archivos: Archivos = {}, extra?: (on: any) => void, opts: Opts = {}) => {
  const raiz = opts.raiz ?? REPO
  mock.clock(on, { now: AHORA })
  mock.store(on)
  mock.env(on, { HOME: '/Users/x' })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'pasos' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [] }))
  on('session.repo', () => ({ value: opts.esRepo === false ? null : { root: raiz, remote: null, internal: false } }))
  on('session.root', () => ({ value: raiz }))
  on('session.id', () => ({ value: 'sesion-1' }))
  on('session.cwd', () => ({ value: raiz }))
  on('fs.read', (_: any, e: any) => {
    const t = archivos[e.path]
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: t }
  })
  on('fs.stat', (_: any, e: any) => {
    if (archivos[e.path] === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: 'file', size: 1, mtimeMs: AHORA - 60_000, isLink: false } }
  })
  on('fs.list', (_: any, e: any) => {
    const base = String(e.path ?? '').replace(/\/$/, '') + '/'
    const nombres = new Map<string, 'file' | 'dir'>()
    for (const ruta of Object.keys(archivos)) {
      if (!ruta.startsWith(base)) continue
      const resto = ruta.slice(base.length).split('/')
      nombres.set(resto[0]!, resto.length > 1 ? 'dir' : 'file')
    }
    return { value: [...nombres].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  if (extra) extra(on)
  else on('tool.call', () => ({ result: {} }))
}

/** Lo que hace una sesión real al retomar un plan: leer su ledger. */
const leerLedger = ($: any, ledger: string) => $.tool.call({ tool: 'Bash', command: `cat ${ledger}/estado.md` })

const start = ($: any) => $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

const progreso = (o: Record<string, unknown>) =>
  JSON.stringify({
    version: 1,
    plan: 'fable-v1',
    titulo: '',
    repo: REPO,
    total: 41,
    aceptadas: 29,
    en_curso: 5,
    bloqueadas: 1,
    ola: '6',
    tarea_actual: 'T40 plantillas',
    actualizado: '2026-11-10T18:30:00Z',
    ...o,
  })

test('un plan con progreso.json muestra su % y su ola', async ($, on) => {
  setup(on, { [`${REPO}/.claude/run/fable-v1/progreso.json`]: progreso({}) })
  await start($)
  await leerLedger($, `${REPO}/.claude/run/fable-v1`)
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /71%/ }))?.text).toMatch(/71%/)
  expect((await ui.find({ type: 'Text', text: /29\/41/ }))?.text).toMatch(/29\/41/)
  expect((await ui.find({ type: 'Text', text: /ola 6/ }))?.text).toMatch(/1 bloq/)
  await ui.unmount()
})

test('el plan se nombra "plan <título>", o "plan <carpeta>" sin título', async ($, on) => {
  setup(on, {
    [`${REPO}/.claude/run/fable-v1/progreso.json`]: progreso({ titulo: 'Integración Bitrix↔Skill v8' }),
    [`${REPO}/.claude/run/otro-v2/progreso.json`]: progreso({ plan: 'otro-v2', titulo: '' }),
  })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cat .claude/run/fable-v1/progreso.json .claude/run/otro-v2/estado.md' })
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /plan Integración Bitrix↔Skill v8/ }))?.text).toMatch(/^▣ plan Integración/)
  expect((await ui.find({ type: 'Text', text: /plan otro-v2/ }))?.text).toMatch(/^▣ plan otro-v2/)
  expect(await ui.find({ type: 'Text', text: /plan fable-v1/ })).toBeUndefined()
  await ui.unmount()
})

test('sin progreso.json el plan sale de estado.md y se marca estimado', async ($, on) => {
  setup(on, {
    [`${REPO}/.claude/run/viejo/estado.md`]: [
      'T02 en_curso 2 0 1  # lo nuevo arriba',
      'T01 aceptada 1 0 1',
      'T02 pendiente 2 0 1',
      'PRS 8-nov: no es una tarea',
      '| T03 | aceptada_con_condiciones | 2 | 1 | x |',
      'T04 bloqueada 2 1 1',
    ].join('\n'),
  })
  await start($)
  await leerLedger($, `${REPO}/.claude/run/viejo`)
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /estimado/ }))?.text).toMatch(/estimado/)
  expect((await ui.find({ type: 'Text', text: /1\/4/ }))?.text).toMatch(/1\/4/)
  await ui.unmount()
})

test('los planes y jobs de otro proyecto se ocultan hasta "/pasos todos"', async ($, on) => {
  const otro = '/Users/x/otro-cliente'
  setup(on, {
    [`${CFG}/run-index/1.json`]: JSON.stringify({ version: 1, ledger: `${otro}/.claude/run/ajeno`, slug: 'ajeno' }),
    [`${otro}/.claude/run/ajeno/progreso.json`]: progreso({ plan: 'ajeno', repo: otro, aceptadas: 10 }),
    [`${CFG}/jobs/aaa/state.json`]: JSON.stringify({ state: 'working', name: 'job ajeno', cwd: otro, updatedAt: '2026-11-10T18:59:00Z' }),
    [`${CFG}/jobs/bbb/state.json`]: JSON.stringify({ state: 'blocked', name: 'job mío', cwd: `${REPO}/sub`, updatedAt: '2026-11-10T18:50:00Z' }),
  })
  await start($)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /ajeno/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /job mío/ }))?.text).toMatch(/job mío/)
  await ui.unmount()

  const r = await $.command.run({ command: 'pasos', args: 'todos' } as any)
  expect(String((r as { text?: string }).text)).toMatch(/todos los proyectos/)
  ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /ajeno/ }))?.text).toMatch(/ajeno/)
  expect((await ui.find({ type: 'Text', text: /job ajeno/ }))?.text).toMatch(/job ajeno/)
  await ui.unmount()
})

test('un job terminado o viejo no aparece', async ($, on) => {
  setup(on, {
    [`${CFG}/jobs/a/state.json`]: JSON.stringify({ state: 'done', name: 'terminado', cwd: REPO, updatedAt: '2026-11-10T18:59:00Z' }),
    [`${CFG}/jobs/b/state.json`]: JSON.stringify({ state: 'working', name: 'colgado', cwd: REPO, updatedAt: '2026-11-08T10:00:00Z' }),
    [`${CFG}/jobs/c/state.json`]: JSON.stringify({ state: 'working', name: 'vivo', cwd: REPO, updatedAt: '2026-11-10T18:58:00Z' }),
  })
  await start($)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /terminado/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /colgado/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /vivo/ }))?.text).toMatch(/vivo/)
  await ui.unmount()
})

test('una llamada que lanza no queda en curso', async ($, on) => {
  setup(on, {}, o =>
    o('tool.call', (_: any, e: any) => {
      if (e.tool === 'Bash') throw new Error('interrumpida')
      return { result: {} }
    }),
  )
  await start($)
  await expect($.tool.call({ tool: 'Bash', command: 'sleep 99' })).rejects.toThrow()
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /en curso/ }))?.text).toMatch(/^0 en curso/)
  expect((await ui.find({ type: 'Text', text: /✗/ }))?.text).toMatch(/✗/)
  await ui.unmount()
})

test('un Bash en segundo plano no se cuenta como hecho', async ($, on) => {
  setup(on, {}, o =>
    o('tool.call', (_: any, e: any) =>
      e.tool === 'Bash' ? { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } } : { result: {} },
    ),
  )
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'npm run dev', run_in_background: true })
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /en 2º plano/ }))?.text).toMatch(/1 en 2º plano/)
  expect((await ui.find({ type: 'Text', text: /hechos/ }))?.text).toMatch(/^0 hechos/)
  await ui.unmount()
})

test('un Workflow muestra nombre, fases y agentes lanzados', async ($, on) => {
  setup(on, {}, o => {
    o('tool.call', (_: any, e: any) =>
      e.tool === 'Workflow' ? { result: { status: 'async_launched', taskId: 't1', runId: 'wf_1' } } : { result: {} },
    )
    o('agent.spawn', () => ({ agentId: 'ag1', model: 'sonnet' }))
  })
  await start($)
  await $.tool.call({
    tool: 'Workflow',
    script:
      "export const meta = {\n  name: 'revisar',\n  description: 'x',\n  phases: [{ title: 'Revisar' }, { title: 'Verificar' }],\n}\nawait agent('a')",
  })
  await $.agent.spawn({ prompt: 'p', description: 'revisor de bugs', workflow: { runId: 'wf_1', agentIndex: 1 } } as any)
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /revisar/ }))?.text).toMatch(/revisar/)
  expect((await ui.find({ type: 'Text', text: /agentes/ }))?.text).toMatch(/0\/1 agentes/)
  expect((await ui.find({ type: 'Text', text: /fases/ }))?.text).toMatch(/Revisar · Verificar/)
  await ui.unmount()
})

test('un plan del repo que la sesión no tocó no aparece; al leer su ledger, sí', async ($, on) => {
  setup(on, { [`${REPO}/.claude/run/fable-v1/progreso.json`]: progreso({}) })
  await start($)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /71%/ })).toBeUndefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Bash', command: 'sh assets/progreso.sh .claude/run/fable-v1 --total 41 --aceptadas 29' })
  ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /71%/ }))?.text).toMatch(/71%/)
  await ui.unmount()
})

test('/pasos plan <nombre> vincula un plan del índice a esta sesión', async ($, on) => {
  const otro = '/Users/x/otro'
  setup(on, {
    [`${CFG}/run-index/9.json`]: JSON.stringify({ version: 1, ledger: `${otro}/.claude/run/migracion`, slug: 'migracion' }),
    [`${otro}/.claude/run/migracion/progreso.json`]: progreso({ plan: 'migracion', repo: otro, aceptadas: 4, total: 8 }),
  })
  await start($)
  const r = await $.command.run({ command: 'pasos', args: 'plan migracion' } as any)
  expect(String((r as { text?: string }).text)).toMatch(/vinculado/)
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /plan migracion/ }))?.text).toMatch(/plan migracion/)
  expect((await ui.find({ type: 'Text', text: /50%/ }))?.text).toMatch(/50%/)
  await ui.unmount()
})

test('desde una carpeta contenedora (~/Dev) no aparecen jobs de otros clientes', async ($, on) => {
  const dev = '/Users/x/Dev'
  setup(
    on,
    {
      [`${CFG}/jobs/a/state.json`]: JSON.stringify({ state: 'working', name: 'job cliente A', cwd: `${dev}/cliente-a`, updatedAt: '2026-11-10T18:59:00Z' }),
      [`${CFG}/jobs/b/state.json`]: JSON.stringify({ state: 'working', name: 'job en Dev', cwd: dev, updatedAt: '2026-11-10T18:59:00Z' }),
    },
    undefined,
    { raiz: dev, esRepo: false },
  )
  await start($)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /cliente A/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /job en Dev/ }))?.text).toMatch(/job en Dev/)
  await ui.unmount()
})
