import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Step, Task } from '../types'

const PANE = 'agent-steps'
// Change the tag when a step's fields change: it declines what an earlier
// version stored, which outlives a reload.
const steps = atom({ plugin: 'agent-steps', key: 'steps' } as const, [], {
  shape: 'steps-1',
})
const tasks = atom({ plugin: 'agent-steps', key: 'tasks' } as const, [], {
  shape: 'tasks-1',
})
const isPaneOn = atom({ plugin: 'agent-steps', key: 'isPaneOn' } as const, false)

const labelOf = (e: Record<string, unknown>): string => {
  const raw = e.command ?? e.file_path ?? e.pattern ?? e.description ?? e.url ?? e.path ?? ''
  return String(raw).replace(/\s+/g, ' ').slice(0, 70)
}

// El panel ocupa 1/FRACCION del ancho de la terminal (mínimo 24 columnas).
const FRACCION = 4

export const register: Register = on => {
  let startedAt = 0
  let lastCols = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pasos',
      description: 'Abre el panel de pasos agrupados por subagente',
    })
    const opened = await $.ui.open({ id: PANE, title: 'Pasos', columns: 26, rows: 10 })
    await update($, isPaneOn, () => opened.isPlaced)

    return next(e)
  })

  on('command.run', { command: 'pasos' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Pasos', columns: 26, rows: 10 })
    await update($, isPaneOn, () => opened.isPlaced)

    return { text: 'Panel de pasos abierto.' }
  })

  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const step: Step = {
      id: e.tool_use_id,
      agentId: e.agentId,
      tool: e.tool,
      label: labelOf(e),
      isDone: false,
      startedAt: await $.clock.now(),
    }
    await update($, steps, list => [...list, step].slice(-300))
    const ran = await next(e)
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'TaskCreate') {
      const made = (ran as { result?: { task?: { id?: string } } }).result?.task?.id
      await update($, tasks, prev => {
        const list = prev.length > 0 && prev.every(t => t.status === 'completed') ? [] : prev
        return [
          ...list,
          {
          id: made ?? String(list.length + 1),
          subject: String(input.subject ?? ''),
          active: String(input.activeForm ?? ''),
          status: 'pending',
        } as Task,
        ]
      })
    } else if (e.tool === 'TaskUpdate') {
      const id = String(input.taskId ?? '')
      const status = input.status as Task['status'] | 'deleted' | undefined
      await update($, tasks, list =>
        status === 'deleted'
          ? list.filter(t => t.id !== id)
          : list.map(t =>
              t.id === id
                ? {
                    ...t,
                    status: status ?? t.status,
                    subject: input.subject ? String(input.subject) : t.subject,
                    active: input.activeForm ? String(input.activeForm) : t.active,
                  }
                : t,
            ),
      )
    } else if (e.tool === 'TaskList') {
      const all = (ran as { result?: { tasks?: { id: string; subject: string; status: Task['status'] }[] } })
        .result?.tasks
      if (Array.isArray(all)) {
        await update($, tasks, prev =>
          all.map(t => ({
            id: String(t.id),
            subject: t.subject,
            active: prev.find(p => p.id === String(t.id))?.active ?? '',
            status: t.status,
          })),
        )
      }
    } else if (e.tool === 'TodoWrite') {
      const todos = (input.todos ?? []) as { content: string; status: Task['status']; activeForm: string }[]
      await update($, tasks, () =>
        todos.map((t, i) => ({ id: String(i + 1), subject: t.content, active: t.activeForm, status: t.status })),
      )
    }
    const now = await $.clock.now()
    await update($, steps, list =>
      list.map(one =>
        one.id === step.id
          ? { ...one, isDone: true, seconds: Math.round((now - one.startedAt) / 1000) }
          : one,
      ),
    )

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
    if (seconds > 60) {
      const total = (await read($, steps)).filter(s => s.startedAt >= startedAt).length
      $.ui.toast(`Turno terminado: ${seconds}s, ${total} pasos`)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, steps)
    const plan = await read($, tasks)
    const agents = await $.agent.list()
    const cwd = await $.session.cwd()
    const room = Math.max(4, (e.viewport?.rows ?? 24) - (plan.length > 0 ? 5 : 3))

    const order: (string | undefined)[] = [undefined, ...agents.map(a => a.id)]
    for (const s of list) if (!order.includes(s.agentId)) order.push(s.agentId)
    const groups = order
      .map(id => ({ id, items: list.filter(s => s.agentId === id) }))
      .filter(g => g.items.length > 0)
    const per = Math.max(2, Math.floor(room / Math.max(1, groups.length)) - 1)
    const running = list.filter(s => !s.isDone).length
    const done = list.length - running
    const doneTasks = plan.filter(t => t.status === 'completed').length
    const pct = plan.length > 0 ? Math.round((100 * doneTasks) / plan.length) : 0
    const current = plan.find(t => t.status === 'in_progress')
    const width = Math.max(8, Math.min(24, (e.props.bodyColumns ?? 28) - 12))

    const nameOf = (id?: string): string => {
      if (id === undefined) return 'Principal'
      const a = agents.find(x => x.id === id)
      return a ? `${a.type} · ${a.description}` : `agente ${id.slice(0, 6)}`
    }
    const stateOf = (id?: string): string =>
      id === undefined ? '' : (agents.find(x => x.id === id)?.status ?? '')

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="claude">◆ Pasos </Text>
          <Text color="warning">{running} en curso</Text>
          <Text color="subtle"> · </Text>
          <Text color="success">{done} hechos</Text>
        </Box>
        {plan.length > 0 && (
          <Box flexDirection="column">
            <Box>
              <Text color="success">{'█'.repeat(Math.round((width * doneTasks) / plan.length))}</Text>
              <Text color="subtle">{'░'.repeat(width - Math.round((width * doneTasks) / plan.length))}</Text>
              <Text bold color={doneTasks === plan.length ? 'success' : 'warning'}> {pct}%</Text>
              <Text color="subtle"> {doneTasks}/{plan.length}</Text>
            </Box>
            {current && <Text color="warning" wrap="truncate-end">▸ {current.active || current.subject}</Text>}
          </Box>
        )}
        <Text color="subtle" wrap="truncate-start">{cwd.replace(/^\/Users\/[^/]+/, '~')}</Text>
        {groups.length === 0 && <Text color="subtle">Sin pasos todavía.</Text>}
        {groups.map(g => {
          const live = g.items.some(s => !s.isDone)
          return (
            <Box flexDirection="column" key={g.id ?? 'main'}>
              <Box>
                <Text color={live ? 'warning' : 'subtle'}>{live ? '● ' : '○ '}</Text>
                <Text bold color={g.id === undefined ? 'claude' : 'suggestion'} wrap="truncate-end">
                  {nameOf(g.id)}
                </Text>
                {stateOf(g.id) !== '' && <Text color="subtle"> {stateOf(g.id)}</Text>}
              </Box>
              {g.items.slice(-per).map(s => (
                <Box key={s.id}>
                  <Text color={s.isDone ? 'success' : 'warning'}>{s.isDone ? ' ✓ ' : ' ▶ '}</Text>
                  <Text bold={!s.isDone} dimColor={s.isDone} wrap="truncate-end">{s.tool} </Text>
                  <Text color="subtle" wrap="truncate-end">{s.label}</Text>
                  {s.seconds ? <Text color="subtle"> {s.seconds}s</Text> : null}
                </Box>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const cols = e.viewport?.columns ?? 0
    if (cols > 0 && cols !== lastCols) {
      lastCols = cols
      if (await read($, isPaneOn)) {
        void $.ui.open({
          id: PANE,
          title: 'Pasos',
          columns: Math.max(24, Math.round(cols / FRACCION)),
          rows: 10,
        })
      }
    }
    if (e.props.hasSurvey || (await read($, isPaneOn))) return next(e)
    const running = (await read($, steps)).filter(s => !s.isDone)
    const cur = running[running.length - 1]
    if (!cur) return next(e)
    const plan = await read($, tasks)
    const pct = plan.length
      ? Math.round((100 * plan.filter(t => t.status === 'completed').length) / plan.length)
      : -1

    const agents = await $.agent.list()
    const who = cur.agentId
      ? (agents.find(a => a.id === cur.agentId)?.type ?? 'agente')
      : 'principal'
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        {pct >= 0 && <Text bold color="success">{pct}% </Text>}
        <Text color="warning">▶ </Text>
        <Text color="suggestion">[{who}] </Text>
        <Text bold>{cur.tool} </Text>
        <Text color="subtle" wrap="truncate-end">{cur.label}</Text>
        {running.length > 1 ? <Text color="subtle">  +{running.length - 1} en paralelo</Text> : null}
      </Box>
    )
  })
}
