import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-steps',
  component: 'Pane',
  requestId: 'agent-steps',
  surface: 'terminal',
  props: {
    title: 'Pasos',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const setup = ($: any, on: any, ids: string[], list?: unknown[]) => {
  let n = 0
  on('command.register', () => ({ value: { command: 'pasos' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('session.cwd', () => ({ value: '/Users/x/proj' }))
  on('tool.call', (_: any, e: any) =>
    e.tool === 'TaskCreate'
      ? { result: { task: { id: ids[n++], subject: e.subject } } }
      : e.tool === 'TaskList'
        ? { result: { tasks: list ?? [] } }
        : { result: {} },
  )
}

test('el porcentaje sube con las tareas completadas', async ($, on) => {
  setup($, on, ['1', '2', '3', '4'])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const s of ['a', 'b', 'c', 'd'])
    await $.tool.call({ tool: 'TaskCreate', subject: s, description: s, activeForm: 'haciendo ' + s })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /25%/ }))?.text).toMatch(/25%/)
  expect((await ui.find({ type: 'Text', text: /haciendo b/ }))?.text).toMatch(/haciendo b/)
  await ui.unmount()
})

test('borrar una tarea cambia el total', async ($, on) => {
  setup($, on, ['1', '2'])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const s of ['a', 'b'])
    await $.tool.call({ tool: 'TaskCreate', subject: s, description: s })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'deleted' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /100%/ }))?.text).toMatch(/100%/)
  await ui.unmount()
})

test('TodoWrite reemplaza la lista completa', async ($, on) => {
  setup($, on, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'x', status: 'completed', activeForm: 'x' },
      { content: 'y', status: 'pending', activeForm: 'y' },
    ],
  })
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /50%/ }))?.text).toMatch(/50%/)
  await ui.unmount()
})

test('un plan nuevo no arrastra las tareas del anterior ya terminadas', async ($, on) => {
  setup($, on, ['1', '2', '3'])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'TaskCreate', subject: 'viejo', description: 'v' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'nuevo A', description: 'a' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'nuevo B', description: 'b' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /0%/ }))?.text).toMatch(/0%/)
  await ui.unmount()
})

test('TaskList reconstruye el plan si el mod no vio las altas', async ($, on) => {
  setup($, on, [], [
    { id: '7', subject: 'a', status: 'completed', blockedBy: [] },
    { id: '8', subject: 'b', status: 'in_progress', blockedBy: [] },
  ])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'TaskList' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /50%/ }))?.text).toMatch(/50%/)
  await ui.unmount()
})
